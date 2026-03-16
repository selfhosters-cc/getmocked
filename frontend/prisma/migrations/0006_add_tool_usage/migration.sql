-- CreateTable
CREATE TABLE "tool_usage" (
    "id" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tool_usage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "tool_usage" ADD CONSTRAINT "tool_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
