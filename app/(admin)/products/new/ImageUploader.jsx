"use client";

import { useState } from "react";
import { createClient } from "../../../../lib/supabase/client";

const MAX_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 8;

// 画像をSupabase Storageにアップロードし、そのURLをフォームに入れる。
// 商品登録時にWooCommerceがURLから画像を取り込む。
export default function ImageUploader({ name = "image_urls" }) {
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;

    setError("");
    if (images.length + files.length > MAX_FILES) {
      setError(`画像は${MAX_FILES}枚までです`);
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const added = [];
    try {
      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          throw new Error(`${file.name} は画像ではありません`);
        }
        if (file.size > MAX_SIZE) {
          throw new Error(`${file.name} は10MBを超えています`);
        }
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("product-images")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw new Error(`${file.name}：${upErr.message}`);
        const { data } = supabase.storage.from("product-images").getPublicUrl(path);
        added.push({ url: data.publicUrl, name: file.name });
      }
    } catch (err) {
      setError(err.message || "アップロードに失敗しました");
    } finally {
      if (added.length) setImages((prev) => [...prev, ...added]);
      setUploading(false);
    }
  }

  function remove(i) {
    setImages((prev) => prev.filter((_, idx) => idx !== i));
  }

  function makeMain(i) {
    setImages((prev) => [prev[i], ...prev.filter((_, idx) => idx !== i)]);
  }

  return (
    <div>
      <div className="uploader-grid">
        {images.map((img, i) => (
          <div key={img.url} className="uploader-item">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={img.name} />
            {i === 0 && <span className="uploader-main">メイン</span>}
            <div className="uploader-actions">
              {i > 0 && (
                <button type="button" onClick={() => makeMain(i)}>
                  メインにする
                </button>
              )}
              <button type="button" onClick={() => remove(i)}>
                削除
              </button>
            </div>
            <input type="hidden" name={name} value={img.url} />
          </div>
        ))}
        {images.length < MAX_FILES && (
          <label className="uploader-add">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={handleFiles}
              disabled={uploading}
              style={{ display: "none" }}
            />
            {uploading ? "アップロード中…" : "＋ 画像を追加"}
          </label>
        )}
      </div>
      {error && <div className="form-hint" style={{ color: "#b91c1c" }}>{error}</div>}
      <div className="form-hint">1枚目がメイン画像になります（JPEG・PNG・WebP、1枚10MBまで、{MAX_FILES}枚まで）</div>
    </div>
  );
}
