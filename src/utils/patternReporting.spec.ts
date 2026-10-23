import { describe, expect, it } from 'vitest';
import pulseConfig from '../../public/config/50-70-260-Pulse-Sens\'O-Neo.json';
import pulseLiteConfig from '../../public/config/50-70-304-Pulse-Sens\'O-Lite-Neo.json';
import {
  findPatternReportingContext,
  isPatternReportingFieldVisible,
  patternReportingMode,
  shouldIncludePatternReportingFrame,
  type PatternReportingSection,
} from './patternReporting';

const standardFrame = '11 06 8005 (sample) (maximum) 00(notification)';
const patternFrame = '11 06 8005 (sample) (maximum) F1 (criterion1) (criterion2) 80 (occurrences1) (occurrences2)';

function sectionWithPattern(): PatternReportingSection {
  return {
    report: {
      fields: {
        sample: { type: 'timeVal', selectedValue: '10', HMI: { visual_type: 'timeSlider' } },
        maximum: { type: 'timeVal', selectedValue: '60', HMI: { visual_type: 'timeSlider' } },
        notification: { type: 'bool', selectedValue: 'true', HMI: { visual_type: 'checkbox' } },
        criterion: { type: 'hex2B', selectedValue: '0 0', HMI: { visual_type: 'pattern' } },
        occurrences: { type: 'hex2B', selectedValue: '1 1', HMI: { visual_type: 'occurrences' } },
      },
    },
    cfg_block: [standardFrame, patternFrame],
  };
}

describe('pattern reporting configuration', () => {
  it('enables the pattern UI only when the product configuration links a pattern field', () => {
    const pulseStandard = pulseConfig.standard_params as PatternReportingSection;
    const pulseLiteStandard = pulseLiteConfig.standard_params as PatternReportingSection;

    expect(findPatternReportingContext(pulseStandard, 'standard_PMultiState_params')).toMatchObject({
      patternFieldName: 'pMultiStatePattern',
      controlFieldName: 'pMultiStateNotification',
    });
    expect(findPatternReportingContext(pulseLiteStandard, 'standard_PMultiState_params')).toBeNull();
  });

  it('detects support by linking a visual pattern field to a frame', () => {
    const section = sectionWithPattern();
    expect(findPatternReportingContext(section, 'report')).toEqual({
      groupName: 'report',
      patternFieldName: 'criterion',
      controlFieldName: 'notification',
      occurrenceFieldNames: ['occurrences'],
    });

    section.cfg_block = [standardFrame];
    expect(findPatternReportingContext(section, 'report')).toBeNull();
  });

  it('derives variation, periodic and pattern modes', () => {
    const section = sectionWithPattern();
    const group = section.report as { fields: Record<string, any> };
    const context = findPatternReportingContext(section, 'report')!;

    expect(patternReportingMode(context, group.fields)).toBe('variation');
    group.fields.notification.selectedValue = 'false';
    expect(patternReportingMode(context, group.fields)).toBe('periodic');
    group.fields.criterion.selectedValue = '5 13';
    expect(patternReportingMode(context, group.fields)).toBe('pattern');
  });

  it('selects one frame and exposes only the relevant fields', () => {
    const section = sectionWithPattern();
    const group = section.report as { fields: Record<string, any> };
    const context = findPatternReportingContext(section, 'report')!;

    expect(shouldIncludePatternReportingFrame(context, standardFrame, group.fields)).toBe(true);
    expect(shouldIncludePatternReportingFrame(context, patternFrame, group.fields)).toBe(false);
    expect(isPatternReportingFieldVisible(context, 'criterion', group.fields)).toBe(false);

    group.fields.notification.selectedValue = 'false';
    expect(shouldIncludePatternReportingFrame(context, standardFrame, group.fields)).toBe(true);
    expect(isPatternReportingFieldVisible(context, 'criterion', group.fields)).toBe(true);
    expect(isPatternReportingFieldVisible(context, 'occurrences', group.fields)).toBe(false);

    group.fields.criterion.selectedValue = '5 13';
    expect(shouldIncludePatternReportingFrame(context, standardFrame, group.fields)).toBe(false);
    expect(shouldIncludePatternReportingFrame(context, patternFrame, group.fields)).toBe(true);
    expect(isPatternReportingFieldVisible(context, 'occurrences', group.fields)).toBe(true);
  });
});
