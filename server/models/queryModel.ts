import { Schema, model, Document } from 'mongoose';

export interface QueryDocument extends Document {
    query: string;
    dest: string;
    response: any;
    createdAt: Date;
    city: string;
    brand: string; // Новое поле для бренда
}

const querySchema = new Schema<QueryDocument>({
    query: { type: String, required: true },
    dest: { type: String, required: true },
    response: { type: Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: Date.now },
    city: { type: String, required: true },
    brand: { type: String, required: true } // Новое поле для бренда
});

export const QueryModel = model<QueryDocument>('Query', querySchema);
