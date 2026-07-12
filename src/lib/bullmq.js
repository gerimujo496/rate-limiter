import process from "node:process";
import "../load-env.js";
import { Queue } from 'bullmq';

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

const myQueue = new Queue('foo', { connection: {
        host: url,
        port: 6379,
        password: token,
        tls: {}
    }});

   