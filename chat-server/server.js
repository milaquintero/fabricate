var app = require('express')();
server = app.listen(5000,function(){
  console.log("server live on port 5000!");
});
var io = require('socket.io')(server, {cors: '*'});
var availableUsers = [];
var availableRooms = [];

//sort user array by username
compareUsers = (a,b) =>{
    return a.username.localeCompare(b.username);
}

//Generate room ID for new rooms
generateID = () =>{
    let text = "";
    let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890";
    for(let i = 0; i < 10; i++){
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
//filter rooms by userID
getCurUserRooms = (userID) =>{
    return availableRooms.filter(room=>{
        //compare using user ID
        return room.users.find(user=>{return user.userID === userID;});
    });
}

io.on('connect',(socket) => {
    console.log('Socket: Client Connected');
    let roomsCurUser = null;
    let roomVisitHistory = [];
    //user joining chat (add to availableUsers)
    socket.on('join', function(userData){
        //emit join event with added userID
        userData.userID = socket.id;
        availableUsers.push(userData);
        socket.emit('join', userData);
        //mmore than one user available, so update list in UI
        if(availableUsers.length > 1){
            io.sockets.emit('availableUsers', availableUsers);
        }
    });
    //user leaving chat (remove from availableUsers)
    socket.on('leave', function(userData){
        let userToRemove = availableUsers.find(user=>{return user.username === userData.username;});
        availableUsers.splice(availableUsers.indexOf(userToRemove), 1);
    });
    //show available users
    socket.on('availableUsers', function(){
        io.sockets.emit('availableUsers', availableUsers);
    });
    //user is entering room
    socket.on('enterRoom', function(enterRoomData){
        //check if there's already a room with the same users
        let foundRoom = availableRooms.find(room=>{
            //sort arrays so rooms aren't duplicated
            return JSON.stringify(room.users.sort(compareUsers)) === JSON.stringify(enterRoomData.selectedRoom.users.sort(compareUsers))
        });
        //create room if one doesn't exist (unique combination of users)
        if(!foundRoom){
            availableRooms.push(enterRoomData.selectedRoom);
            //set foundRoom to new room (provided by front-end)
            foundRoom = enterRoomData.selectedRoom;
            //set up id for new room (needed for initial room setup, but is replaced by socket io hashed value)
            foundRoom.roomID = generateID();
        }
        /**
         * Up tp date socket rooms 'Array.from(socket.rooms)' required for each part of the following process:
         * 
        */
        //pre-join rooms for cur user
        let preJoinSocketRooms = Array.from(socket.rooms);
        //leave previous room if user is joining new one
        if(foundRoom && foundRoom.roomID && preJoinSocketRooms.length > 1){
            let prevRoom = preJoinSocketRooms.pop();
            socket.leave(prevRoom);
        }
        //join room
        socket.join(foundRoom.roomID);
        //post-join rooms for cur user
        let postJoinSocketRooms = Array.from(socket.rooms);
        //set actual roomID based on socket io hashed value (second element because first is default socket room)
        foundRoom.roomID = postJoinSocketRooms.pop();
        //get rooms with user in it
        roomsCurUser = getCurUserRooms(enterRoomData.userEntering.userID);
        //send room with ID to frontend (only to cur user so others don't get UI changes when they haven't performed actions)
        io.to(enterRoomData.userEntering.userID).emit('selectedRoom', foundRoom);
        //send rooms for curUser to frontend to curUser
        io.to(enterRoomData.userEntering.userID).emit('updatedCurUserRooms', roomsCurUser);
        //send system message to room that user has joined chat and hasn't joined room before
        if(roomVisitHistory.indexOf(foundRoom.roomID) === -1){
            foundRoom.messages.push({
                sentBy: {
                    profilePic: '',
                    username: 'Fabricate',
                    userID: '',
                    role: 'system'
                },
                content: enterRoomData.userEntering.username + ' has joined the chat.',
                dateSent: new Date()
            });
            io.to(foundRoom.roomID).emit('newMsg', foundRoom.messages);
        }
        //add to visit history
        roomVisitHistory.push(foundRoom.roomID);
    });
    //send new request to specific user
    socket.on('newRequest', function(newRequestData){
        //add new request with new requestID
        newRequestData.userTo.requests.push({
            sentBy: newRequestData.userFrom,
            room: newRequestData.selectedRoom,
            status: 'pending',
            requestID: generateID()
        });
        //emit updated request list
        io.to(newRequestData.userTo.userID).emit('roomRequest', newRequestData.userTo.requests);
    });
    //update request by removing it from user's queue
    socket.on('updateRequest', function(updateRequestData){
        //find associated room
        let foundRoom = availableRooms.find(room=>{
            return room.roomID === updateRequestData.request.room.roomID;
        });
        //find user-who-updated in found room
        let foundUser = foundRoom.users.find(user=>{
            return user.userID === updateRequestData.curUser.userID;
        });
        //find user-who-updated's requests
        let foundUserRequests = foundUser.requests;
        //remove request from list
        foundUserRequests = foundUserRequests.filter(request=>{
            return request.requestID !== updateRequestData.request.requestID;
        });
        //emit updated request list (applies for any operation)
        io.to(updateRequestData.curUser.userID).emit('roomRequest', foundUserRequests);
        //handle denied room request
        if(updateRequestData.operation === 'denied'){
            //remove user from room in availableRooms
            foundRoom.users = foundRoom.users.filter(user=>{
                return user.userID !== updateRequestData.curUser.userID;
            });
            //update actual users array in availableRooms
            availableRooms[availableRooms.indexOf(foundRoom)].users = [].concat(foundRoom.users);
            //update user list to users in room
            io.to(foundRoom.roomID).emit('updatedRoomUsers', foundRoom.users);
            //send system message to room that user has denied request
            foundRoom.messages.push({
                sentBy: {
                    profilePic: '',
                    username: 'Fabricate',
                    userID: '',
                    role: 'system'
                },
                content: updateRequestData.curUser.username + ' has denied the request to join.',
                dateSent: new Date()
            });
            io.to(foundRoom.roomID).emit('newMsg', foundRoom.messages);
            //individually send updated user rooms to all other users in room (each belongs to unique set of rooms)
            foundRoom.users.forEach(user=>{
                let userUpdatedRooms = getCurUserRooms(user.userID);
                io.to(user.userID).emit('updatedCurUserRooms', userUpdatedRooms);
            });
            //update for user rooms for curUser
            let curUserUpdatedRooms = getCurUserRooms(updateRequestData.curUser.userID);
            io.to(updateRequestData.curUser.userID).emit('updatedCurUserRooms', curUserUpdatedRooms);
        }
    });
    //relay chat data (handle & message) to sockets in room
    socket.on('sendMessage', function(selectedRoom){
        //add messages to room
        availableRooms.find(room=>{
            //sort arrays so rooms aren't duplicated
            return JSON.stringify(room.users.sort(compareUsers)) === JSON.stringify(selectedRoom.users.sort(compareUsers))
        }).messages = selectedRoom.messages;
        //socket Room Set to array
        let userRooms = Array.from(socket.rooms);
        //get rooms with user in it
        roomsCurUser = availableRooms.filter(room=>{
            return userRooms.indexOf(room.roomID) !== -1;
        });
        //return room to allowed users
        io.to(selectedRoom.roomID).emit('newMsg', selectedRoom.messages);
    });
    //broadcast handle that is typing to available sockets
    //goes to all except the socket that emitted the typing event
    socket.on('typing', function(username){
        socket.broadcast.emit('typing', username);
    });
});