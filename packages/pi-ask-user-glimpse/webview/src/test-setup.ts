import "@testing-library/jest-dom";

// Mock scrollIntoView for jsdom (used by Questionnaire auto-scroll)
Element.prototype.scrollIntoView = () => {};
