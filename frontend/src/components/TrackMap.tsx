import React, { useEffect, useRef } from 'react';
import type { CarMotionData, ParticipantData } from '../hooks/useTelemetry';
import { TEAM_COLORS } from './LeaderboardTower';

interface TrackMapProps {
  motion?: CarMotionData | null;
  allMotion?: CarMotionData[];
  participants?: ParticipantData[];
  selectedCarIndex?: number;
  trackPath: { x: number; z: number }[];
}

export const TrackMap: React.FC<TrackMapProps> = ({
  motion,
  allMotion = [],
  participants = [],
  selectedCarIndex = 0,
  trackPath,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const activePositions = allMotion.length > 0
      ? allMotion
      : (motion ? [motion] : []);

    if (trackPath.length === 0 && activePositions.length === 0) {
      ctx.fillStyle = 'var(--text-muted, #666)';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for live motion data...', canvas.width / 2, canvas.height / 2);
      return;
    }

    // Find bounding box to scale and center the map
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    const allPoints = [
      ...trackPath,
      ...activePositions.map(p => ({ x: p.WorldPositionX, z: p.WorldPositionZ })),
    ];

    allPoints.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    });

    if (maxX === minX) { minX -= 100; maxX += 100; }
    if (maxZ === minZ) { minZ -= 100; maxZ += 100; }

    const padding = 25;
    const drawWidth = canvas.width - padding * 2;
    const drawHeight = canvas.height - padding * 2;

    const trackWidth = maxX - minX;
    const trackHeight = maxZ - minZ;

    const scaleX = drawWidth / trackWidth;
    const scaleZ = drawHeight / trackHeight;
    const scale = Math.min(scaleX, scaleZ);

    const offsetX = (canvas.width - trackWidth * scale) / 2 - minX * scale;
    const offsetZ = (canvas.height - trackHeight * scale) / 2 - minZ * scale;

    const mapX = (x: number) => x * scale + offsetX;
    const mapZ = (z: number) => canvas.height - (z * scale + offsetZ);

    // 1. Draw recorded track path
    if (trackPath.length > 1) {
      ctx.beginPath();
      ctx.moveTo(mapX(trackPath[0].x), mapZ(trackPath[0].z));
      for (let i = 1; i < trackPath.length; i++) {
        ctx.lineTo(mapX(trackPath[i].x), mapZ(trackPath[i].z));
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    // 2. Draw all active car position markers
    activePositions.forEach((m, idx) => {
      // Ignore uninitialized zero positions
      if (Math.abs(m.WorldPositionX) < 0.01 && Math.abs(m.WorldPositionZ) < 0.01) return;

      const cx = mapX(m.WorldPositionX);
      const cz = mapZ(m.WorldPositionZ);

      const participant = participants[idx];
      const teamColor = participant ? (TEAM_COLORS[participant.TeamId] || '#FF3333') : '#FF3333';
      const isSelected = idx === selectedCarIndex;

      if (isSelected) {
        // Outer glowing pulse ring for selected car
        ctx.beginPath();
        ctx.arc(cx, cz, 12, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cz, 8, 0, Math.PI * 2);
        ctx.fillStyle = teamColor;
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(cx, cz, 5, 0, Math.PI * 2);
        ctx.fillStyle = teamColor;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Draw Car Number or Position Tag
      const label = participant?.RaceNumber ? `#${participant.RaceNumber}` : `${idx + 1}`;
      ctx.font = 'bold 9px sans-serif';
      ctx.fillStyle = isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.85)';
      ctx.textAlign = 'center';
      ctx.fillText(label, cx, cz - 8);
    });
  }, [motion, allMotion, participants, selectedCarIndex, trackPath]);

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

