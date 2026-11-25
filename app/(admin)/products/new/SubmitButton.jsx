"use client";

import { useFormStatus } from "react-dom";

export default function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "登録中…（画像の取り込みに少し時間がかかります）" : "登録する"}
    </button>
  );
}
