Feature: Local Package Backup

  As a pi user
  I want to save my package configuration to a local file
  So that I have a recovery point for my extension setup

  Background:
    Given pi is configured with package-guard extension
    And the following packages are registered:
      | package_name      |
      | npm:pi-token-burden |
      | npm:pi-timer      |

  Scenario: Create local backup
    Given I select "Save backup to file + Gist"
    When the backup operation executes
    Then a JSON file should be created at "~/.pi/agent/package-guard-backup.json"
    And the file should contain:
      | field                |
      | $schema              |
      | timestamp            |
      | npmPackages          |

  Scenario: Backup success message
    Given I select "Save backup to file + Gist"
    When the backup completes successfully
    Then I should see: "✓ Local backup saved: ~/.pi/agent/package-guard-backup.json"

  Scenario: Custom backup path
    Given I have configured custom backup path "/tmp/my-backup.json"
    When I select "Save backup to file + Gist"
    Then the backup should be saved to "/tmp/my-backup.json"

  Scenario: Path validation rejects invalid paths
    Given I attempt to set backup path to "/etc/passwd"
    When the path is validated
    Then I should see an error
    And the path should not be saved

  Scenario: Backup file format
    Given a backup file exists
    When I read its contents
    Then it should be valid JSON with 2-space indentation
