import * as fs from 'fs';
import * as path from 'path';
import { toOutcomeJSON, toReplayJSON, Replay } from '../replay';
import { Outcome } from '../gamecore.interface';

describe('replay', () => {
  describe('toOutcomeJSON (omitempty parity)', () => {
    it('always includes over', () => {
      expect(toOutcomeJSON({ over: false })).toEqual({ over: false });
      expect(toOutcomeJSON({ over: true })).toEqual({ over: true });
    });

    it('omits passed when false', () => {
      const json = toOutcomeJSON({ over: true, passed: false });
      expect(json).not.toHaveProperty('passed');
    });

    it('includes passed when true', () => {
      const json = toOutcomeJSON({ over: true, passed: true });
      expect(json.passed).toBe(true);
    });

    it('omits stars when 0', () => {
      const json = toOutcomeJSON({ over: true, stars: 0 });
      expect(json).not.toHaveProperty('stars');
    });

    it('omits winner when 0', () => {
      const json = toOutcomeJSON({ over: true, winner: 0 });
      expect(json).not.toHaveProperty('winner');
    });

    it('omits scores when undefined or empty, keeps when non-empty', () => {
      expect(toOutcomeJSON({ over: true })).not.toHaveProperty('scores');
      expect(toOutcomeJSON({ over: true, scores: {} })).not.toHaveProperty(
        'scores',
      );
      const json = toOutcomeJSON({ over: true, scores: { '1': 0, '2': 5 } });
      expect(json.scores).toEqual({ '1': 0, '2': 5 });
    });

    it('omits metrics when undefined or empty, but keeps all keys including zero values when non-empty', () => {
      expect(toOutcomeJSON({ over: true })).not.toHaveProperty('metrics');
      expect(toOutcomeJSON({ over: true, metrics: {} })).not.toHaveProperty(
        'metrics',
      );
      const outcome: Outcome = {
        over: true,
        metrics: { enemiesDefeated: 0, gold: 0, steps: 5 },
      };
      const json = toOutcomeJSON(outcome);
      expect(json.metrics).toEqual({
        enemiesDefeated: 0,
        gold: 0,
        steps: 5,
      });
    });
  });

  describe('golden fixture round-trip', () => {
    it('re-serializes cs1-01-move-right.json identically', () => {
      const fixturePath = path.join(
        __dirname,
        'fixtures',
        'cs1-01-move-right.json',
      );
      const raw = fs.readFileSync(fixturePath, 'utf-8');
      const original = JSON.parse(raw);
      const replay = original as Replay;

      const reserialized = toReplayJSON(replay);

      expect(reserialized).toEqual(original);
      expect(reserialized).not.toHaveProperty('outcome.winner');
      expect(reserialized).not.toHaveProperty('outcome.scores');
    });
  });
});
