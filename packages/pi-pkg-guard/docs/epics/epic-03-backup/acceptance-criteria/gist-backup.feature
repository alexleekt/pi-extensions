Feature: GitHub Gist Cloud Backup

  As a pi user working across multiple machines
  I want to sync my package backup to a GitHub Gist
  So that I can restore my configuration on any machine with GitHub access

  Background:
    Given pi is configured with package-guard extension
    And GitHub CLI (gh) is installed and authenticated

  Scenario: Create new Gist backup
    Given Gist backup is not configured
    When I select "Set up new GitHub Gist backup"
    Then a new public Gist should be created
    And the Gist ID should be stored in configuration
    And I should see: "✓ Created GitHub Gist"

  Scenario: Sync to existing Gist
    Given a Gist is configured with ID "abc123def456..."
    When I select "Save backup to file + Gist"
    Then the backup should sync to GitHub Gist
    And I should see: "✓ Synced to GitHub Gist"

  Scenario: Disable backup sync
    Given Gist backup sync is enabled
    When I disconnect the Gist
    Then future backups should save locally only
    And the Gist ID should be preserved

  Scenario: Enable backup sync
    Given Gist backup sync is disabled
    And a Gist ID is configured
    When I connect a Gist
    Then future backups should sync to Gist automatically

  Scenario: Switch Gist
    Given a Gist is configured with ID "old123..."
    When I select "Switch to a different Gist"
    And I enter new Gist ID "new456..."
    Then the new Gist ID should replace the old one

  Scenario: Remove Gist backup
    Given a Gist is configured
    When I select "Remove Gist backup"
    And I confirm the deletion
    Then the Gist should be deleted from GitHub
    And local configuration should be cleared

  Scenario: Invalid Gist ID rejection
    Given I enter Gist ID "abc123; rm -rf /"
    When the ID is validated
    Then I should see an error
    And the ID should not be accepted

  Scenario: Gist URL extraction
    Given I enter Gist URL "https://gist.github.com/user/abc123def456..."
    When the URL is processed
    Then the extracted Gist ID should be "abc123def456..."

  Scenario: Gist operation without gh CLI
    Given GitHub CLI is not installed
    When I attempt to create or sync a Gist
    Then I should see an error about gh CLI requirement
