import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true })
  full_name: string;

  @Prop({ required: true, unique: true })
  username: string;

  @Prop()
  avatar_url?: string;

  @Prop()
  bio?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
