import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, X, SwitchCamera } from 'lucide-react';

interface InlineCameraProps {
  onCapture: (base64: string) => void;
  onClose: () => void;
}

export function InlineCamera({ onCapture, onClose }: InlineCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const startCamera = useCallback(async () => {
    try {
      if (stream) stream.getTracks().forEach(t => t.stop());
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch {
      // fallback
    }
  }, [facingMode]);

  useEffect(() => { startCamera(); return () => { stream?.getTracks().forEach(t => t.stop()); }; }, [facingMode]);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const base64 = canvas.toDataURL('image/jpeg', 0.8);
    stream?.getTracks().forEach(t => t.stop());
    onCapture(base64);
  };

  return (
    <div className="relative rounded-lg overflow-hidden bg-black">
      <video ref={videoRef} autoPlay playsInline muted className="w-full aspect-video object-cover" />
      <canvas ref={canvasRef} className="hidden" />
      <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-4">
        <Button size="icon" variant="secondary" onClick={onClose}><X className="h-5 w-5" /></Button>
        <Button size="lg" onClick={capture} className="rounded-full h-14 w-14"><Camera className="h-6 w-6" /></Button>
        <Button size="icon" variant="secondary" onClick={() => setFacingMode(f => f === 'environment' ? 'user' : 'environment')}><SwitchCamera className="h-5 w-5" /></Button>
      </div>
    </div>
  );
}
