import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const summarySource = readFileSync(new URL('../components/MatchupV2Summary.tsx', import.meta.url), 'utf8');
const filmRoomSource = readFileSync(new URL('../components/MatchupRealDataTab.tsx', import.meta.url), 'utf8');
const cardStart = summarySource.indexOf('function KeyMatchupCard');
const cardEnd = summarySource.indexOf('export const MatchupV2KeyMatchups', cardStart);
const cardSource = summarySource.slice(cardStart, cardEnd);

describe('Matchup V2 web interaction structure', () => {
  test('keeps Film Room and reason expansion as sibling controls', () => {
    const cardContainer = cardSource.indexOf('<View style={[styles.keyMatchupCard');
    const mainAction = cardSource.indexOf('testID={`matchup-v2-key-matchup-');
    const mainActionClose = cardSource.indexOf('</Pressable>', mainAction);
    const reasonsAction = cardSource.indexOf('onPress={handleToggleReasons}');

    expect(cardContainer).toBeGreaterThan(-1);
    expect(mainAction).toBeGreaterThan(cardContainer);
    expect(mainActionClose).toBeGreaterThan(mainAction);
    expect(reasonsAction).toBeGreaterThan(mainActionClose);
    expect(cardSource).not.toContain('stopPropagation');
  });

  test('keeps both independent actions keyboard and screen-reader accessible', () => {
    expect(cardSource.match(/focusable/g)?.length).toBe(2);
    expect(cardSource.match(/accessibilityRole="button"/g)?.length).toBe(2);
    expect(cardSource).toContain('accessibilityState={{ expanded: reasonsExpanded }}');
  });

  test('keeps Matchup player-picker backdrops and sheets as sibling regions', () => {
    expect(summarySource).not.toContain('<Pressable style={styles.modalBackdrop} onPress={onClose}>');
    expect(filmRoomSource).not.toContain('<Pressable style={styles.modalBackdrop} onPress={onClose}>');
    expect(summarySource).toContain('style={styles.modalBackdropDismiss}');
    expect(filmRoomSource.match(/style=\{styles\.modalBackdropDismiss\}/g)?.length).toBe(2);
  });
});
