/**
 * XML Validation Utilities
 * Prevents XXE (XML External Entity) attacks by validating XML before parsing
 */

/**
 * Validates XML content to prevent XXE attacks
 * Rejects XML containing DOCTYPE, ENTITY, SYSTEM, or PUBLIC declarations
 *
 * @param xmlText - The XML content to validate
 * @throws Error if XML contains potentially malicious content
 */
export function validateXml(xmlText: string): void {
  // Check for DOCTYPE declarations (can contain entity definitions)
  if (/<!DOCTYPE/i.test(xmlText)) {
    throw new Error('XML contains DOCTYPE declaration - not allowed for security reasons');
  }

  // Check for entity declarations (used in XXE attacks)
  if (/<!ENTITY/i.test(xmlText)) {
    throw new Error('XML contains ENTITY declaration - not allowed for security reasons');
  }

  // Check for external references (SYSTEM and PUBLIC)
  if (/SYSTEM/i.test(xmlText)) {
    throw new Error('XML contains SYSTEM reference - not allowed for security reasons');
  }

  if (/PUBLIC/i.test(xmlText)) {
    throw new Error('XML contains PUBLIC reference - not allowed for security reasons');
  }

  // Check for parameter entities (another XXE vector)
  if (/%[a-zA-Z0-9_-]+;/.test(xmlText)) {
    throw new Error('XML contains parameter entity - not allowed for security reasons');
  }

  // Basic size check to prevent DoS (max 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (xmlText.length > maxSize) {
    throw new Error(`XML size exceeds maximum allowed size of ${maxSize} bytes`);
  }

  // Check for excessive nesting (billion laughs prevention)
  const entityCount = (xmlText.match(/<!ENTITY/g) || []).length;
  if (entityCount > 0) {
    throw new Error('Entity declarations not allowed');
  }
}

/**
 * Sanitizes XML by removing potentially dangerous content
 * Use this as a last resort - prefer validateXml() and rejecting invalid XML
 *
 * @param xmlText - The XML content to sanitize
 * @returns Sanitized XML content
 */
export function sanitizeXml(xmlText: string): string {
  // Remove DOCTYPE declarations
  let sanitized = xmlText.replace(/<!DOCTYPE[^>]*>/gi, '');

  // Remove entity declarations
  sanitized = sanitized.replace(/<!ENTITY[^>]*>/gi, '');

  return sanitized;
}
