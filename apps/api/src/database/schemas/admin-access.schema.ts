import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * The admin-console allowlist: one row per address allowed to sign in to
 * admin.obiren.co. The password itself stays on the linked `User` account, so
 * a single Argon2 hash is authoritative for both sign-in paths.
 *
 * No HTTP route writes here. Rows are created and changed only by the
 * server-side `npm run admin:set` script (scripts/set-admin.ts), which is why a
 * client can never mint admin credentials.
 */
export type AdminAccessDocument = AdminAccess & Document;

@Schema({ timestamps: true, collection: 'admin_accounts' })
export class AdminAccess {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  /** As entered by the operator, for display in the console. */
  @Prop({ type: String, required: true })
  email: string;

  /** Lowercase form; the only value the sign-in path compares against. */
  @Prop({ type: String, required: true, unique: true, index: true })
  emailNormalized: string;

  @Prop({ type: String, required: true, enum: ['active', 'disabled'], default: 'active' })
  status: string;

  @Prop({ type: Date })
  lastConsoleLoginAt?: Date;

  /** Who added this row and why, for the audit trail. */
  @Prop({ type: String })
  note?: string;
}

export const AdminAccessSchema = SchemaFactory.createForClass(AdminAccess);
