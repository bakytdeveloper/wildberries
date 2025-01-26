import { Schema, model, Document } from 'mongoose';

export interface QueryDocument extends Document {
    query: string;
    dest: string;
    response: any;
    createdAt: Date;
    city: string;
}

const querySchema = new Schema<QueryDocument>({
    query: { type: String, required: true },
    dest: { type: String, required: true },
    response: { type: Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: Date.now },
    city: { type: String, required: true }
});

export const QueryModel = model<QueryDocument>('Query', querySchema);
