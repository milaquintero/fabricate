import { Component, OnDestroy, OnInit } from '@angular/core';
import { Event, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { User } from 'src/app/models/user';
import { ChatService } from 'src/app/services/chat.service';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.sass']
})
export class LoginComponent implements OnInit, OnDestroy{

  images:Array<object> = [
    {
      src: '../../../assets/cat.png',
      description: 'cat looking at camera'
    },
    {
      src: '../../../assets/dog.png',
      description: 'dog looking at camera'
    },
    {
      src: '../../../assets/owl.png',
      description: 'sloth looking at camera'
    },
    {
      src: '../../../assets/panda-bear.png',
      description: 'panda bear looking at camera'
    },
    {
      src: '../../../assets/guinea-pig.png',
      description: 'guinea pig looking at camera'
    },
    {
      src: '../../../assets/bear.png',
      description: 'bear looking at camera'
    }
  ];

  username:string = "";
  selectedProfilePic = null;
  isUsernameUnavailable:boolean = true;
  isFormValid:boolean = true;
  availableUsersSub:Subscription = new Subscription();
  unavailableUsernames:Array<string> = new Array<string>();

  constructor(private userService:UserService, public router:Router, private chatService:ChatService) { }

  public ngOnDestroy(): void{
    this.availableUsersSub.unsubscribe();
  }

  public ngOnInit(): void {
    this.availableUsersSub = this.chatService.getAvailableUsers().subscribe((users:Array<User>)=>{
      //list of usernames already in use
      this.unavailableUsernames = users.map((user:User)=>{
        return user.username;
      });
      //check if selected username is still available
      this.checkAvailability();
    });
  }

  public setProfilePic(image):void{
    this.selectedProfilePic = image;
  }

  public checkAvailability(){
    //reset form error message
    if(!this.isFormValid)
      this.isFormValid = true;
    setTimeout(()=>{
      //check if username is available
      this.isUsernameUnavailable = this.unavailableUsernames.indexOf(this.username) !== -1;
    }, 0)
  }

  public submitUser():void{
    this.isFormValid = !this.isUsernameUnavailable && this.selectedProfilePic !== null && this.username.length !== 0;
    if(this.isFormValid){
      let curUser = new User(this.selectedProfilePic, this.username);
      this.userService.setUser(curUser);
      //redirect to home
      this.router.navigate(['home']);
    }
  }

}
