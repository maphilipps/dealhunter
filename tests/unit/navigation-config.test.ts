import { describe, it, expect } from 'vitest';
import {
  QUALIFICATION_NAVIGATION_SECTIONS,
  getSectionByRoute,
  getSectionById,
  getAllSections,
  getAllSectionIds,
  isValidSectionRoute,
  getRAGQueryTemplate,
  getSynthesizerAgent,
  type LeadNavigationSection,
} from '@/lib/pitches/navigation-config';

describe('navigation-config', () => {
  describe('QUALIFICATION_NAVIGATION_SECTIONS', () => {
    it('should have 8 sections', () => {
      expect(QUALIFICATION_NAVIGATION_SECTIONS).toHaveLength(8);
    });

    it('should have all required section IDs', () => {
      const expectedIds = [
        'overview',
        'customer',
        'qualification-scan',
        'pitch-scan',
        'calc-sheet',
        'decision',
        'interview',
        'rag-data',
      ];

      const actualIds = QUALIFICATION_NAVIGATION_SECTIONS.map(s => s.id);
      expect(actualIds).toEqual(expectedIds);
    });

    it('should have unique section IDs', () => {
      const ids = QUALIFICATION_NAVIGATION_SECTIONS.map(s => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have unique routes', () => {
      const routes = QUALIFICATION_NAVIGATION_SECTIONS.map(s => s.route);
      const uniqueRoutes = new Set(routes);
      expect(uniqueRoutes.size).toBe(routes.length);
    });

    it('should have all required fields for each section', () => {
      QUALIFICATION_NAVIGATION_SECTIONS.forEach(section => {
        expect(section).toHaveProperty('id');
        expect(section).toHaveProperty('label');
        expect(section).toHaveProperty('icon');
        expect(section).toHaveProperty('route');
        expect(section.id).toBeTruthy();
        expect(section.label).toBeTruthy();
        expect(section.icon).toBeTruthy();
      });
    });

    it('should have RAG query templates for all main sections (except debug and interview)', () => {
      QUALIFICATION_NAVIGATION_SECTIONS.forEach(section => {
        if (section.id === 'rag-data' || section.id === 'interview') return;
        expect(section.ragQueryTemplate).toBeTruthy();
        expect(section.ragQueryTemplate!.length).toBeGreaterThan(10);
      });
    });

    it('should have synthesizer agents for all standard sections', () => {
      QUALIFICATION_NAVIGATION_SECTIONS.forEach(section => {
        if (section.id === 'rag-data' || section.id === 'interview') return;
        expect(section.synthesizerAgent).toBeTruthy();
      });
    });

    it('should have 13 pitch-scan subsections', () => {
      const pitchScan = QUALIFICATION_NAVIGATION_SECTIONS.find(s => s.id === 'pitch-scan');
      expect(pitchScan).toBeDefined();
      expect(pitchScan!.subsections).toHaveLength(14); // overview + 13 sections
    });
  });

  describe('getSectionByRoute', () => {
    it('should return section for valid route', () => {
      const section = getSectionByRoute('qualification-scan');
      expect(section).toBeDefined();
      expect(section?.id).toBe('qualification-scan');
    });

    it('should return overview section for empty route', () => {
      const section = getSectionByRoute('');
      expect(section).toBeDefined();
      expect(section?.id).toBe('overview');
    });

    it('should return pitch-scan section for pitch-scan route', () => {
      const section = getSectionByRoute('pitch-scan');
      expect(section).toBeDefined();
      expect(section?.id).toBe('pitch-scan');
    });

    it('should return pitch-scan subsection for pitch-scan/* routes', () => {
      const section = getSectionByRoute('pitch-scan/ps-discovery');
      expect(section).toBeDefined();
      expect(section?.id).toBe('ps-discovery');
    });

    it('should normalize routes with leading/trailing slashes', () => {
      const section1 = getSectionByRoute('/qualification-scan/');
      const section2 = getSectionByRoute('qualification-scan');
      expect(section1?.id).toBe('qualification-scan');
      expect(section2?.id).toBe('qualification-scan');
      expect(section1).toEqual(section2);
    });

    it('should return undefined for invalid route', () => {
      const section = getSectionByRoute('invalid-route');
      expect(section).toBeUndefined();
    });

    it('should return undefined for removed routes', () => {
      expect(getSectionByRoute('technology')).toBeUndefined();
      expect(getSectionByRoute('website-analysis')).toBeUndefined();
      expect(getSectionByRoute('hosting')).toBeUndefined();
      expect(getSectionByRoute('costs')).toBeUndefined();
    });
  });

  describe('getSectionById', () => {
    it('should return section for valid ID', () => {
      const section = getSectionById('qualification-scan');
      expect(section).toBeDefined();
      expect(section?.id).toBe('qualification-scan');
    });

    it('should return undefined for invalid ID', () => {
      const section = getSectionById('invalid-id');
      expect(section).toBeUndefined();
    });

    it('should return correct section for all section IDs', () => {
      QUALIFICATION_NAVIGATION_SECTIONS.forEach(expectedSection => {
        const section = getSectionById(expectedSection.id);
        expect(section).toBeDefined();
        expect(section?.id).toBe(expectedSection.id);
        expect(section?.label).toBe(expectedSection.label);
      });
    });

    it('should return undefined for removed section IDs', () => {
      expect(getSectionById('technology')).toBeUndefined();
      expect(getSectionById('website-analysis')).toBeUndefined();
      expect(getSectionById('target-architecture')).toBeUndefined();
      expect(getSectionById('cms-comparison')).toBeUndefined();
      expect(getSectionById('hosting')).toBeUndefined();
      expect(getSectionById('integrations')).toBeUndefined();
      expect(getSectionById('migration')).toBeUndefined();
      expect(getSectionById('project-org')).toBeUndefined();
      expect(getSectionById('costs')).toBeUndefined();
    });
  });

  describe('getAllSections', () => {
    it('should return all 8 sections', () => {
      const sections = getAllSections();
      expect(sections).toHaveLength(8);
    });

    it('should return the same reference as QUALIFICATION_NAVIGATION_SECTIONS', () => {
      const sections = getAllSections();
      expect(sections).toBe(QUALIFICATION_NAVIGATION_SECTIONS);
    });
  });

  describe('getAllSectionIds', () => {
    it('should return array of 8 section IDs', () => {
      const ids = getAllSectionIds();
      expect(ids).toHaveLength(8);
    });

    it('should return correct IDs in order', () => {
      const ids = getAllSectionIds();
      expect(ids[0]).toBe('overview');
      expect(ids[1]).toBe('customer');
      expect(ids[2]).toBe('qualification-scan');
      expect(ids[3]).toBe('pitch-scan');
      expect(ids[4]).toBe('calc-sheet');
    });

    it('should match the IDs from QUALIFICATION_NAVIGATION_SECTIONS', () => {
      const ids = getAllSectionIds();
      const expectedIds = QUALIFICATION_NAVIGATION_SECTIONS.map(s => s.id);
      expect(ids).toEqual(expectedIds);
    });
  });

  describe('isValidSectionRoute', () => {
    it('should return true for valid routes', () => {
      expect(isValidSectionRoute('qualification-scan')).toBe(true);
      expect(isValidSectionRoute('pitch-scan')).toBe(true);
      expect(isValidSectionRoute('')).toBe(true); // overview
    });

    it('should return false for invalid routes', () => {
      expect(isValidSectionRoute('invalid')).toBe(false);
      expect(isValidSectionRoute('nonexistent')).toBe(false);
    });

    it('should return false for removed routes', () => {
      expect(isValidSectionRoute('technology')).toBe(false);
      expect(isValidSectionRoute('cms-comparison')).toBe(false);
      expect(isValidSectionRoute('hosting')).toBe(false);
    });

    it('should handle routes with slashes', () => {
      expect(isValidSectionRoute('/qualification-scan/')).toBe(true);
      expect(isValidSectionRoute('/invalid/')).toBe(false);
    });
  });

  describe('getRAGQueryTemplate', () => {
    it('should return RAG query template for valid section ID', () => {
      const template = getRAGQueryTemplate('qualification-scan');
      expect(template).toBeDefined();
      expect(template).toContain('qualifications scan');
    });

    it('should return undefined for invalid section ID', () => {
      const template = getRAGQueryTemplate('invalid-id');
      expect(template).toBeUndefined();
    });

    it('should return templates for all sections (except debug)', () => {
      QUALIFICATION_NAVIGATION_SECTIONS.forEach(section => {
        if (section.id === 'rag-data') return;
        const template = getRAGQueryTemplate(section.id);
        if (section.id === 'interview') {
          // interview has empty template
          return;
        }
        expect(template).toBeDefined();
        expect(template).toBe(section.ragQueryTemplate);
      });
    });
  });

  describe('getSynthesizerAgent', () => {
    it('should return synthesizer agent for valid section ID', () => {
      const agent = getSynthesizerAgent('qualification-scan');
      expect(agent).toBeDefined();
      expect(agent).toBe('qualification-scan-synthesizer');
    });

    it('should return undefined for invalid section ID', () => {
      const agent = getSynthesizerAgent('invalid-id');
      expect(agent).toBeUndefined();
    });

    it('should return agents for all sections (except debug and interview)', () => {
      QUALIFICATION_NAVIGATION_SECTIONS.forEach(section => {
        if (section.id === 'rag-data' || section.id === 'interview') return;
        const agent = getSynthesizerAgent(section.id);
        expect(agent).toBeDefined();
        expect(agent).toBe(section.synthesizerAgent);
      });
    });
  });
});
