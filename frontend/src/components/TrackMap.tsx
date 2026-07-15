import React, { useEffect, useRef } from 'react';
import type { CarMotionData } from '../hooks/useTelemetry';

interface TrackMapProps {
  motion: CarMotionData | null;
  trackPath: { x: number; z: number }[];
}

export const TrackMap: React.FC<TrackMapProps> = ({ motion, trackPath }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (trackPath.length === 0 && !motion) {
      // Draw placeholder text if no data
      ctx.fillStyle = 'var(--text-muted, #666)';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for motion data...', canvas.width / 2, canvas.height / 2);
      return;
    }

    // Find bounding box to scale and center the map
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    const allPoints = motion 
      ? [...trackPath, { x: motion.WorldPositionX, z: motion.WorldPositionZ }] 
      : trackPath;

    allPoints.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    });

    // Default bounds if only one point or perfectly straight line
    if (maxX === minX) { minX -= 100; maxX += 100; }
    if (maxZ === minZ) { minZ -= 100; maxZ += 100; }

    const padding = 20;
    const drawWidth = canvas.width - padding * 2;
    const drawHeight = canvas.height - padding * 2;
    
    const trackWidth = maxX - minX;
    const trackHeight = maxZ - minZ;

    const scaleX = drawWidth / trackWidth;
    const scaleZ = drawHeight / trackHeight;
    const scale = Math.min(scaleX, scaleZ); // Uniform scale to maintain aspect ratio

    // Calculate center offset
    const offsetX = (canvas.width - trackWidth * scale) / 2 - minX * scale;
    const offsetZ = (canvas.height - trackHeight * scale) / 2 - minZ * scale;

    const mapX = (x: number) => x * scale + offsetX;
    // F1 game Z axis typically maps to Y on screen (invert Z if needed for visual correctness)
    const mapZ = (z: number) => canvas.height - (z * scale + offsetZ); 

    // 1. Draw track path
    if (trackPath.length > 1) {
      ctx.beginPath();
      ctx.moveTo(mapX(trackPath[0].x), mapZ(trackPath[0].z));
      for (let i = 1; i < trackPath.length; i++) {
        ctx.lineTo(mapX(trackPath[i].x), mapZ(trackPath[i].z));
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    // 2. Draw current car position
    if (motion) {
      const cx = mapX(motion.WorldPositionX);
      const cz = mapZ(motion.WorldPositionZ);

      // Draw pulse effect
      ctx.beginPath();
      ctx.arc(cx, cz, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 51, 51, 0.3)'; // Match accent primary roughly
      ctx.fill();

      // Draw solid car dot
      ctx.beginPath();
      ctx.arc(cx, cz, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'var(--accent-primary, #ff3333)';
      ctx.fill();
    }

  }, [motion, trackPath]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <canvas 
        ref={canvasRef} 
        width={400} 
        height={300} 
        style={{ width: '100%', height: '100%', maxHeight: '300px', objectFit: 'contain' }} 
      />
    </div>
  );
};
