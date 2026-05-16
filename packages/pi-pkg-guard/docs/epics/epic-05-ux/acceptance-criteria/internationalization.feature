Feature: Internationalization

  As a non-English pi user
  I want to interact with package-guard in my preferred language
  So that I can understand notifications and prompts clearly

  Background:
    Given pi is configured with package-guard extension

  Scenario: Locale detection from pi settings
    Given pi locale is set to "es-ES"
    When package-guard initializes
    Then the locale should be detected as "es-ES"

  Scenario: Messages in detected locale
    Given locale is set to "es-ES"
    When a notification is displayed
    Then it should appear in Spanish

  Scenario: English fallback for unsupported locale
    Given locale is set to an unsupported language "xx-XX"
    When a message is displayed
    Then it should appear in English (en-US)

  Scenario: Pluralization - singular
    Given a message with count 1
    When formatted
    Then it should display "1 unregistered package"

  Scenario: Pluralization - plural
    Given a message with count 3
    When formatted
    Then it should display "3 unregistered packages"

  Scenario: ICU MessageFormat variables
    Given message template: "Registered {count} unregistered {count, plural, one {package} other {packages}}"
    And count is 1
    When formatted
    Then result should be: "Registered 1 unregistered package"

  Scenario: ICU MessageFormat plural
    Given message template: "Found {count} unregistered {count, plural, one {package} other {packages}}"
    And count is 5
    When formatted
    Then result should be: "Found 5 unregistered packages"

  Scenario: New locale registration
    Given a new translation dictionary for "fr-FR"
    When registered via registerLocale()
    And locale is set to "fr-FR"
    Then messages should appear in French
