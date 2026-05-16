Feature: Custom Backup Path

  As a pi user
  I want to specify a custom backup file location
  So that I can store backups in my preferred directory structure

  Background:
    Given pi is configured with package-guard extension

  Scenario: Set valid custom path within ~/.pi/agent/
    Given I select "Change where backups are saved"
    When I enter path "~/.pi/agent/my-backup.json"
    Then the path should be accepted
    And it should be saved to configuration

  Scenario: Set valid custom path in temp directory
    Given I select "Change where backups are saved"
    When I enter path "/tmp/pi-pkg-backup.json"
    Then the path should be accepted
    And it should be saved to configuration

  Scenario: Path expansion from tilde
    Given I enter path "~/my-backup.json"
    When the path is saved
    Then it should be expanded to "$HOME/my-backup.json"

  Scenario: Reject path outside allowed directories
    Given I select "Change where backups are saved"
    When I enter path "/etc/passwd"
    Then I should see error: "Invalid path. Must be within ~/.pi/agent/ or temp directory"
    And the path should not be saved

  Scenario: Reject path traversal attempt
    Given I select "Change where backups are saved"
    When I enter path "~/.pi/agent/../../../etc/passwd"
    Then I should see an error about invalid path
    And the path should not be saved

  Scenario: Path persists across sessions
    Given I have set custom path "~/.pi/agent/custom-backup.json"
    When I exit and restart pi
    Then the custom path should be preserved
