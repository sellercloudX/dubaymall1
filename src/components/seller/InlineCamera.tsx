import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Camera, X, SwitchCamera } from 'lucide-react';

interface InlineCameraProps {
  onCapture: (base64: string) => void;
  onClose: () => void;
  initialStream: MediaStream;
}

export function InlineCamera({ onCapture, onClose, initialStream }: InlineCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream>(initialStream);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isReady, setIsReady] = useState(false);

  const stopStream = useCallback((s?: MediaStream | null) => {
    (s || stream)?.getTracks().forEach(t => t.stop());
  }, [stream]);

  // Attach initial stream to video on mount
  useEffect(() => {
    if (videoRef.current && initialStream) {
      videoRef.current.srcObject = initialStream;
      videoRef.current.onloadedmetadata = () => setIsReady(true);
    }
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const handleSwitch = async () => {
    const newFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newFacing);
    setIsReady(false);
    try {
      stopStream(stream);
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacing, width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.onloadedmetadata = () => setIsReady(true);
      }
    } catch (err) {
      console.error('Camera switch error:', err);
    }
  };

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const base64 = canvas.toDataURL('image/jpeg', 0.85);
    stopStream();
    onCapture(base64);
  };

  const handleClose = () => {
    stopStream();
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 bg-black flex flex-col" style={{ zIndex: 99999 }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="flex-1 w-full h-full object-cover"
      />
      <canvas ref={canvasRef} className="hidden" />

      <div className="absolute top-0 left-0 right-0 flex justify-end p-4" style={{ paddingTop: 'calc(env(safe-area-inset-top, 12px) + 12px)' }}>
        <Button
          size="icon"
          variant="secondary"
          className="rounded-full h-10 w-10 bg-black/50 backdrop-blur-sm border-0 text-white hover:bg-black/70"
          onClick={handleClose}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-6 pb-6"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 24px)' }}
      >
        <Button
          size="icon"
          variant="secondary"
          className="rounded-full h-12 w-12 bg-white/20 backdrop-blur-sm border-0 text-white hover:bg-white/30"
          onClick={handleSwitch}
        >
          <SwitchCamera className="h-5 w-5" />
        </Button>

        <button
          onClick={capture}
          disabled={!isReady}
          className="h-[72px] w-[72px] rounded-full border-4 border-white flex items-center justify-center transition-transform active:scale-90 disabled:opacity-50"
        >
          <div className="h-[60px] w-[60px] rounded-full bg-white" />
        </button>

        <div className="h-12 w-12" />
      </div>
    </div>,
    document.body
  );
}

/**
 * Helper: call this directly inside an onClick handler to get the stream,
 * then pass it to <InlineCamera initialStream={stream} />.
 */
export async function requestCameraStream(facing: 'environment' | 'user' = 'environment'): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } }
  });
}
