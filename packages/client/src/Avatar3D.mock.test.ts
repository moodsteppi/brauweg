import { useGLTF } from '@react-three/drei';
import { describe, expect, it } from 'vitest';

describe('Avatar3D: Mock-Probe', () => {
  it('useGLTF bleibt eine Funktion (nicht ein Objekt)', () => {
    expect(typeof useGLTF).toBe('function');
  });

  it('useGLTF.preload() wirft nicht', () => {
    expect(() => useGLTF.preload('/3d/pinguin_base.glb')).not.toThrow();
  });
});
