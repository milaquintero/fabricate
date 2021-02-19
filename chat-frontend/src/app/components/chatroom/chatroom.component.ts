import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, Renderer2, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Message } from 'src/app/models/message';
import { Room } from 'src/app/models/room';
import { User } from 'src/app/models/user';
import { ChatService } from 'src/app/services/chat.service';
import { RoomService } from 'src/app/services/room.service';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-chatroom',
  templateUrl: './chatroom.component.html',
  styleUrls: ['./chatroom.component.sass']
})
export class ChatroomComponent implements OnInit, OnDestroy {

  selectedRoom: Room = null;
  messageContent: string = "";
  curUser: User = null;
  headerUsers: Array<User> = null;
  typingMessage:string = null;
  isFormValid:boolean = true;
  curUserSub:Subscription = new Subscription();
  selectedRoomSub:Subscription = new Subscription();
  watchMessagesSub:Subscription = new Subscription();
  watchRoomUsersSub:Subscription = new Subscription();
  watchForUsersTypingSub:Subscription = new Subscription();
  watchRoomsCurUserSub:Subscription = new Subscription();
  duplicateRoom:boolean = false;
  ignoreDuplicateRoom:boolean = false;
  constructor(private roomService: RoomService, private userService: UserService, private chatService: ChatService,
    private router:Router) { }
  ngOnDestroy(): void {
    //unsubscribe to events/updates
    this.curUserSub.unsubscribe();
    this.selectedRoomSub.unsubscribe();
    this.watchMessagesSub.unsubscribe();
    this.watchRoomUsersSub.unsubscribe();
    this.watchForUsersTypingSub.unsubscribe();
    this.watchRoomsCurUserSub.unsubscribe();
  }

  ngOnInit(): void {
    this.curUserSub = this.userService.getUser().subscribe((user) => {
      this.curUser = user;
    });
    this.selectedRoomSub = this.roomService.getRoom().subscribe((selectedRoom) => {
      this.selectedRoom = selectedRoom;
      if (this.selectedRoom) {
        //filters out curUser
        this.headerUsers = this.selectedRoom.users.filter(user => { return user.username !== this.curUser.username });
        //no other users in room
        if(!this.headerUsers.length){
          this.focusElement('allUsersLeftAlert', 150);
        }
        else{
          //focus on last message on init
          this.focusElement('lastMsg', 150);
        }
      }
    });
    //watch changes in messages
    this.watchMessagesSub = this.chatService.watchMessages().subscribe((selectedRoomMsgs:Array<Message>)=>{
      this.selectedRoom.messages = selectedRoomMsgs;
      //focus on last message when it's received
      this.focusElement('lastMsg');
      //clear typing message when new message is received
      this.typingMessage = null;
    });
    //watch changes for users in room
    this.watchRoomUsersSub = this.chatService.watchRoomUsers().subscribe((roomUsers:Array<User>)=>{
      this.selectedRoom.users = roomUsers.map(user=>{
        return new User(user.profilePic, user.username, user.userID, user.role, user.requests);
      });
      this.roomService.setRoom(this.selectedRoom);
    });
    //watch for typing messages
    this.watchForUsersTypingSub = this.chatService.watchForUsersTyping().subscribe((typingData:string)=>{
      this.typingMessage = typingData;
      //focus on typing display if user if typing
      if(this.typingMessage){
        this.focusElement('typingMessage');
      }
      //focus on last message if no longer typing
      else{
        this.focusElement('lastMsg');
      }
    });
    //watch changes for current user rooms event
    this.watchRoomsCurUserSub = this.chatService.watchCurUserRooms().subscribe((roomsCurUser:Array<Room>)=>{
        //update available rooms
        let updatedRoomsCurUser = roomsCurUser.map(room=>{
          return new Room(room.users, room.messages, room.roomID);
        });
        //check for duplicate user groups in rooms
        let prevRoomUsers:Array<User> = new Array<User>();
        updatedRoomsCurUser.forEach((room:Room)=>{
          if(!this.ignoreDuplicateRoom && JSON.stringify(room.users.sort(this.compareUsers)) === JSON.stringify(prevRoomUsers.sort(this.compareUsers))){
            //show duplicate room alert
            this.duplicateRoom = true;
            this.focusElement('duplicateRoomAlert', 150);
          }
          else{
            this.duplicateRoom = false;
          }
          prevRoomUsers = room.users;
        });
        //update roomsCurUser in shareable resource
        this.roomService.setRoomsCurUser(updatedRoomsCurUser);
    });
  }

  sendMessage() {
    this.isFormValid = this.messageContent.length !== 0 && this.headerUsers.length !== 0 && !this.duplicateRoom;
    if(this.isFormValid){
      var newMessage = new Message(this.curUser, this.messageContent, new Date());
      this.selectedRoom.addMessage(newMessage);
      this.chatService.sendMessage(this.selectedRoom);
      //clear message input box text
      this.messageContent = "";
    }
  }

  addUser(){
    this.router.navigate(['handle-room', 'add']);
  }

  leaveRoom(){
    this.chatService.leaveRoom(this.curUser, this.selectedRoom);
    //redirect to home page with prevRoomDeleted flag set to true
    this.router.navigate(['home']);
  }

  determineDateFormat(dateSent: Date): string {
    //set up end of yesterday to compare
    let endOfYesterday = new Date();
    endOfYesterday.setHours(0, 0, 0, 0);
    //return shortTime if message sent today else return shortDate
    return (new Date(dateSent)) > endOfYesterday ? 'shortTime' : 'shortDate';
  }

  isNextMsgSameUser(curMsg: Message, nextMsg: Message): boolean {
    if (curMsg && nextMsg) {
      return curMsg.sentBy.userID === nextMsg.sentBy.userID;
    }
  }

  isLastMsg(message:Message){
    return this.selectedRoom.messages.indexOf(message) === this.selectedRoom.messages.length-1 ? 'lastMsg' : undefined;
  }

  //broadcast username of user typing
  userIsTyping(){
    //reset form error message
    if(!this.isFormValid)
      this.isFormValid = true;
    //emit username only if message isn't empty (sending null clears 'typingMessage' display)
    setTimeout(() => {
      let typingData:string = this.messageContent.length ? this.curUser.username : null;
      this.chatService.userIsTyping(typingData, this.selectedRoom.roomID);
    }, 100);
  }

  //keep duplicate room
  keepDuplicateRoom(){
    this.duplicateRoom = false;
    this.ignoreDuplicateRoom = true;
  }

  focusElement(elementId:string, delay?:number){
    //clear blur for focused element
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    //add delay if provided or default to 100ms
    setTimeout(()=>{
      //handle focusing on appropriate element
      let element = document.getElementById(elementId);
      if(element){
        //focus on element if exists in DOM
        element.focus();
      }
    }, delay || 100);
  }

  allControlsDisabled(){
    //disable all controls if only user in chat is curUser
    return this.headerUsers.length === 0 || this.duplicateRoom;
  }

  //sort user array by username
  compareUsers = (a,b) =>{
    return a.username.localeCompare(b.username);
  }

}
