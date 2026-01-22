import { describe, it, expect } from 'vitest';
import {
  LEAD_NAVIGATION_SECTIONS,
  getSectionByRoute,
  getSectionById,
  getAllSections,
  getAllSectionIds,
  isValidSectionRoute,
  getRAGQueryTemplate,
  getSynthesizerAgent,
  type LeadNavigationSection,
} from '@/lib/leads/navigation-config';

describe('navigation-config', () => {
  describe('LEAD_NAVIGATION_SECTIONS', () => {
    it('should have exactly 13 sections', () => {
      expect(LEAD_NAVIGATION_SECTIONS).toHaveLength(13);
    });

    it('should have all required section IDs', () => {
      const expectedIds = [
        'overview',
        'technology',
        'website-analysis',
        'cms-architecture',
        'cms-comparison',
        'hosting',
        'integrations',
        'migration',
        'staffing',
        'references',
        'legal',
        'costs',
        'decision',
      ];

      const actualIds = LEAD_NAVIGATION_SECTIONS.map(s => s.id);
      expect(actualIds).toEqual(expectedIds);
    });

    it('should have unique section IDs', () => {
      const ids = LEAD_NAVIGATION_SECTIONS.map(s => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have unique routes', () => {
      const routes = LEAD_NAVIGATION_SECTIONS.map(s => s.route);
      const uniqueRoutes = new Set(routes);
      expect(uniqueRoutes.size).toBe(routes.length);
    });

    it('should have all required fields for each section', () => {
      LEAD_NAVIGATION_SECTIONS.forEach(section => {
        expect(section).toHaveProperty('id');
        expect(section).toHaveProperty('label');
        expect(section).toHaveProperty('icon');
        expect(section).toHaveProperty('route');
        expect(section.id).toBeTruthy();
        expect(section.label).toBeTruthy();
        expect(section.icon).toBeTruthy();
      });
    });

    it('should have RAG query templates for all sections', () => {
      LEAD_NAVIGATION_SECTIONS.forEach(section => {
        expect(section.ragQueryTemplate).toBeTruthy();
        expect(section.ragQueryTemplate!.length).toBeGreaterThan(10);
      });
    });

    it('should have synthesizer agents for all sections', () => {
      LEAD_NAVIGATION_SECTIONS.forEach(section => {
        expect(section.synthesizerAgent).toBeTruthy();
        expect(section.synthesizerAgent).toContain('synthesizer');
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
      LEAD_NAVIGATION_SECTIONS.forEach(expectedSection => {
        const section = getSectionById(expectedSection.id);
        expect(section).toBeDefined();
        expect(section?.id).toBe(expectedSection.id);
        expect(section?.label).toBe(expectedSection.label);
      });
    });
  });

  describe('getAllSections', () => {
    it('should return all 13 sections', () => {
      const sections = getAllSections();
      expect(sections).toHaveLength(13);
    });

    it('should return the same reference as LEAD_NAVIGATION_SECTIONS', () => {
      const sections = getAllSections();
      expect(sections).toBe(LEAD_NAVIGATION_SECTIONS);
    });
  });

  describe('getAllSectionIds', () => {
    it('should return array of 13 section IDs', () => {
      const ids = getAllSectionIds();
      expect(ids).toHaveLength(13);
    });

    it('should return correct IDs in order', () => {
      const ids = getAllSectionIds();
      expect(ids[0]).toBe('overview');
      expect(ids[1]).toBe('technology');
      expect(ids[12]).toBe('decision');
    });

    it('should match the IDs from LEAD_NAVIGATION_SECTIONS', () => {
      const ids = getAllSectionIds();
      const expectedIds = LEAD_NAVIGATION_SECTIONS.map(s => s.id);
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

    it('should return templates for all sections', () => {
      LEAD_NAVIGATION_SECTIONS.forEach(section => {
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

    it('should return agents for all sections', () => {
      LEAD_NAVIGATION_SECTIONS.forEach(section => {
        const agent = getSynthesizerAgent(section.id);
        expect(agent).toBeDefined();
        expect(agent).toBe(section.synthesizerAgent);
      });
    });

    it('should follow naming convention *-synthesizer', () => {
      LEAD_NAVIGATION_SECTIONS.forEach(section => {
        const agent = getSynthesizerAgent(section.id);
        expect(agent).toMatch(/-synthesizer$/);
      });
    });
  });
});
