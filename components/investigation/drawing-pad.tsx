"use client";

import { useRef } from "react";

export function DrawingPad({
  onChange,
}: {
  onChange: (value: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  function withContext(callback: (ctx: CanvasRenderingContext2D) => void) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    callback(ctx);
    onChange(canvas.toDataURL("image/png"));
  }

  return (
    <div className="space-y-3">
      <canvas
        ref={canvasRef}
        width={420}
        height={220}
        className="w-full rounded-3xl border border-dashed border-[var(--border)] bg-white"
        onPointerDown={(event) => {
          drawingRef.current = true;
          withContext((ctx) => {
            ctx.lineCap = "round";
            ctx.lineWidth = 4;
            ctx.strokeStyle = "#14323d";
            ctx.beginPath();
            ctx.moveTo(event.nativeEvent.offsetX, event.nativeEvent.offsetY);
          });
        }}
        onPointerMove={(event) => {
          if (!drawingRef.current) {
            return;
          }
          withContext((ctx) => {
            ctx.lineTo(event.nativeEvent.offsetX, event.nativeEvent.offsetY);
            ctx.stroke();
          });
        }}
        onPointerUp={() => {
          drawingRef.current = false;
        }}
        onPointerLeave={() => {
          drawingRef.current = false;
        }}
      />
      <button
        type="button"
        className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold"
        onClick={() => {
          const canvas = canvasRef.current;
          if (!canvas) {
            return;
          }
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            return;
          }
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          onChange(null);
        }}
      >
        Clear drawing
      </button>
    </div>
  );
}
