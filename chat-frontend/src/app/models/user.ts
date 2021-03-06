import { Request } from "./request";

export class User{
    userID:string;
    profilePic:object;
    username:string;
    requests:Array<Request>;
    role:string;
    constructor(profilePic:object, username:string, userID?:string, role?:string, requests?:Array<Request>){
        this.userID = userID;
        this.profilePic = profilePic;
        this.username = username;
        this.requests = requests || new Array<Request>();
        this.role = role || "user";
    }
}