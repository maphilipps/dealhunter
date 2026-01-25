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
} from '@/lib/qualifications/navigation-config';

describe('navigation-config', () => {
  describe('QUALIFICATION_NAVIGATION_SECTIONS', () => {
    it('should have 14 sections', () => {
      expect(QUALIFICATION_NAVIGATION_SECTIONS).toHaveLength(14);
    });

    it('should have all required section IDs', () => {
      const expectedIds = [
        'overview',
        'technology',
        'website-analysis',
        'target-architecture',
        'cms-comparison',
        'hosting',
        'integrations',
        'migration',
        'project-org',
        'costs',
        'calc-sheet',
        'decision',
        'audit',
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

    it('should have RAG query templates for all main sections (except debug)', () => {
      QUALIFICATION_NAVIGATION_SECTIONS.forEach(section => {
        if (section.id === 'rag-data') return;
        expect(section.ragQueryTemplate).toBeTruthy();
        expect(section.ragQueryTemplate!.length).toBeGreaterThan(10);
      });
    });

    it('should have synthesizer agents for all standard sections', () => {
      QUALIFICATION_NAVIGATION_SECTIONS.forEach(section => {
        if (section.id === 'rag-data') return;
        expect(section.synthesizerAgent).toBeTruthy();
      });
    });
  });

  describe('getSectionByRoute', () => {
    it('should return section for valid route', () => {
      const section = getSectionByRoute('technology');
      expect(section).toBeDefined();
      expect(section?.id).toBe('technology');
    });

    it('should return overview section for empty route', () => {
      const section = getSectionByRoute('');
      expect(section).toBeDefined();
      expect(section?.id).toBe('overview');
    });

    it('should normalize routes with leading/trailing slashes', () => {
      const section1 = getSectionByRoute('/technology/');
      const section2 = getSectionByRoute('technology');
      expect(section1?.id).toBe('technology');
      expect(section2?.id).toBe('technology');
      expect(section1).toEqual(section2);
    });

    it('should return undefined for invalid route', () => {
      const section = getSectionByRoute('invalid-route');
      expect(section).toBeUndefined();
    });
  });

  describe('getSectionById', () => {
    it('should return section for valid ID', () => {
      const section = getSectionById('technology');
      expect(section).toBeDefined();
      expect(section?.id).toBe('technology');
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
  });

  describe('getAllSections', () => {
    it('should return all 14 sections', () => {
      const sections = getAllSections();
      expect(sections).toHaveLength(14);
    });

    it('should return the same reference as QUALIFICATION_NAVIGATION_SECTIONS', () => {
      const sections = getAllSections();
      expect(sections).toBe(QUALIFICATION_NAVIGATION_SECTIONS);
    });
  });

  describe('getAllSectionIds', () => {
    it('should return array of 14 section IDs', () => {
      const ids = getAllSectionIds();
      expect(ids).toHaveLength(14);
    });

    it('should return correct IDs in order', () => {
      const ids = getAllSectionIds();
      expect(ids[0]).toBe('overview');
      expect(ids[1]).toBe('technology');
      expect(ids[11]).toBe('decision');
    });

    it('should match the IDs from QUALIFICATION_NAVIGATION_SECTIONS', () => {
      const ids = getAllSectionIds();
      const expectedIds = QUALIFICATION_NAVIGATION_SECTIONS.map(s => s.id);
      expect(ids).toEqual(expectedIds);
    });
  });

  describe('isValidSectionRoute', () => {
    it('should return true for valid routes', () => {
      expect(isValidSectionRoute('technology')).toBe(true);
      expect(isValidSectionRoute('cms-comparison')).toBe(true);
      expect(isValidSectionRoute('')).toBe(true); // overview
    });

    it('should return false for invalid routes', () => {
      expect(isValidSectionRoute('invalid')).toBe(false);
      expect(isValidSectionRoute('nonexistent')).toBe(false);
    });

    it('should handle routes with slashes', () => {
      expect(isValidSectionRoute('/technology/')).toBe(true);
      expect(isValidSectionRoute('/invalid/')).toBe(false);
    });
  });

  describe('getRAGQueryTemplate', () => {
    it('should return RAG query template for valid section ID', () => {
      const template = getRAGQueryTemplate('technology');
      expect(template).toBeDefined();
      expect(template).toContain('technology');
    });

    it('should return undefined for invalid section ID', () => {
      const template = getRAGQueryTemplate('invalid-id');
      expect(template).toBeUndefined();
    });

    it('should return templates for all sections (except debug)', () => {
      QUALIFICATION_NAVIGATION_SECTIONS.forEach(section => {
        if (section.id === 'rag-data') return;
        const template = getRAGQueryTemplate(section.id);
        expect(template).toBeDefined();
        expect(template).toBe(section.ragQueryTemplate);
      });
    });
  });

  describe('getSynthesizerAgent', () => {
    it('should return synthesizer agent for valid section ID', () => {
      const agent = getSynthesizerAgent('technology');
      expect(agent).toBeDefined();
      expect(agent).toBe('technology-synthesizer');
    });

    it('should return undefined for invalid section ID', () => {
      const agent = getSynthesizerAgent('invalid-id');
      expect(agent).toBeUndefined();
    });

    it('should return agents for all sections (except debug)', () => {
      QUALIFICATION_NAVIGATION_SECTIONS.forEach(section => {
        if (section.id === 'rag-data') return;
        const agent = getSynthesizerAgent(section.id);
        expect(agent).toBeDefined();
        expect(agent).toBe(section.synthesizerAgent);
      });
    });

    it('should follow naming convention *-synthesizer (except calc-sheet, audit)', () => {
      QUALIFICATION_NAVIGATION_SECTIONS.forEach(section => {
        // Skip sections without synthesizer or with special agent names
        if (section.id === 'rag-data' || section.id === 'calc-sheet' || section.id === 'audit')
          return;
        const agent = getSynthesizerAgent(section.id);
        expect(agent).toMatch(/-synthesizer$/);
      });
    });
  });
});
