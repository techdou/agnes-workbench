-- MediaAsset 加收藏字段 + 全局画廊索引
ALTER TABLE "MediaAsset" ADD COLUMN "favorited" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MediaAsset" ADD COLUMN "favoritedAt" TIMESTAMP(3);

-- 某用户的收藏列表(全局画廊按用户拉收藏)
CREATE INDEX "MediaAsset_userId_favorited_idx" ON "MediaAsset"("userId", "favorited");
