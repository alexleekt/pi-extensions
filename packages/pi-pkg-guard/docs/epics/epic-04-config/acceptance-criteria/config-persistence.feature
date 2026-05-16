Feature: Configuration Persistence

  As a pi user
  I want my backup and Gist preferences to persist across sessions
  So that I don't need to reconfigure settings each time I use pi

  Background:
    Given pi is configured with package-guard extension
    And settings are stored at "~/.pi/agent/settings.json"

  Scenario: Persist custom backup path
    Given I configure backup path "~/.pi/agent/my-backup.json"
    When I exit pi
    And I restart pi
    Then the configuration should contain:
      | key         | value                            |
      | backupPath  | ~/.pi/agent/my-backup.json       |

  Scenario: Persist Gist ID
    Given I configure Gist ID "abc123def456..."
    When I exit pi
    And I restart pi
    Then the configuration should contain:
      | key         | value                            |
      | gistId      | abc123def456...                  |

  Scenario: Persist backup sync setting
    Given Gist backup sync is enabled
    When I exit pi
    And I restart pi
    Then the configuration should contain:
      | key           | value  |
      | gistAutoSync  | true   |

  Scenario: Type guard validation on load
    Given settings.json contains invalid configuration
    When pi starts
    Then the configuration should return empty object
    And pi should not crash

  Scenario: Settings file format
    Given configuration is saved
    When I read settings.json
    Then it should be valid JSON
    And it should contain "pi-pkg-guard" key with configuration object
