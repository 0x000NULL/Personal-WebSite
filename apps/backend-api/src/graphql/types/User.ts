import { ObjectType, Field, ID, registerEnumType } from 'type-graphql';

export enum UserRole {
  ADMIN = 'admin',
  EDITOR = 'editor',
  USER = 'user'
}

registerEnumType(UserRole, {
  name: 'UserRole',
  description: 'User role types'
});

@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field()
  username: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  firstName?: string;

  @Field({ nullable: true })
  lastName?: string;

  @Field({ nullable: true })
  bio?: string;

  @Field({ nullable: true })
  avatarUrl?: string;

  @Field(() => UserRole)
  role: UserRole;

  @Field()
  isActive: boolean;

  @Field()
  emailVerified: boolean;

  @Field({ nullable: true })
  lastLogin?: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  // Virtual fields
  @Field({ nullable: true })
  displayName?: string;

  @Field()
  isOnline?: boolean;
}

@ObjectType()
export class AuthPayload {
  @Field()
  token: string;

  @Field(() => User)
  user: User;

  @Field()
  expiresIn: number;
}