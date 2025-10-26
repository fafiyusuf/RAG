// /config/db.js
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

export async function connectDB(uri = process.env.MONGO_URI) {
    if (!uri) {
        throw new Error('MONGO_URI environment variable is not set');
    }

    try {
        await mongoose.connect(uri, {
            dbName: "rag_db",
        });

        console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);

        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('MongoDB disconnected');
        });

        // graceful shutdown
        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            console.log('MongoDB connection closed due to app termination');
            process.exit(0);
        });

        return mongoose;
    } catch (err) {
        console.error('Failed to connect to MongoDB:', err);
        throw err;
    }
}
