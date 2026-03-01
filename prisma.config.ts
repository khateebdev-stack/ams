import "dotenv/config";
import { defineConfig } from "prisma/config";
import path from "path";

export default defineConfig({
    schema: path.resolve(__dirname, "prisma/schema.prisma"),
    migrations: {
        path: path.resolve(__dirname, "prisma/migrations"),
    },
    datasource: {
        url: process.env.DATABASE_URL,
    },
});
