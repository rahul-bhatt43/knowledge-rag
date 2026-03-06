import { Types } from "mongoose";
import { UserRole } from "./common.types";

export interface User {
  id: string;
  email: string;
  name?: string;
  roles?: string[];
}

export default User;



export interface PopulatedUser {
  _id: Types.ObjectId;
  firstName: string;
  lastName?: string;
  role: UserRole;
  email: string;
}
