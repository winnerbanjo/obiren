import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, trim: true }) // Display email form
  email: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true }) // Single canonical unique index
  emailNormalized: string;

  @Prop({ required: false })
  passwordHash: string;

  @Prop({
    type: String,
    enum: ['pending_verification', 'active', 'restricted', 'suspended', 'deletion_pending', 'deleted'],
    default: 'pending_verification',
  })
  status: string;

  @Prop({ type: [String], default: ['user'] })
  roles: string[];

  @Prop({ type: String, default: 'NG' })
  countryCode: string;

  @Prop({ type: String, default: 'Africa/Lagos' })
  timeZone: string;

  @Prop({ type: String, default: 'en' })
  preferredLanguage: string;

  @Prop({ type: Date })
  emailVerifiedAt?: Date;

  @Prop({ type: Date })
  lastLoginAt?: Date;

  @Prop({ type: Date })
  deletionRequestedAt?: Date;

  @Prop({ type: Date })
  deletedAt?: Date;

  @Prop({ type: Number, default: 1 })
  schemaVersion: number;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ emailNormalized: 1 }, { unique: true });
UserSchema.index({ status: 1, createdAt: -1 });

export type UserProfileDocument = UserProfile & Document;

@Schema({ timestamps: true, collection: 'user_profiles' })
export class UserProfile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ type: String })
  firstName: string;

  @Prop({ type: String })
  lastName: string;

  @Prop({ type: String })
  displayName: string;

  @Prop({ type: Date })
  dateOfBirth: Date;

  @Prop({ type: String })
  phoneNumber: string;

  @Prop({ type: String, default: 'NG' })
  countryCode: string;

  @Prop({ type: String, default: 'Africa/Lagos' })
  timeZone: string;

  @Prop({ type: String, default: 'CYCLE_TRACKING' })
  trackingGoal: string;

  @Prop({ type: String, default: 'COMPLETED' })
  onboardingStatus: string;
}

export const UserProfileSchema = SchemaFactory.createForClass(UserProfile);
UserProfileSchema.index({ userId: 1 }, { unique: true });
