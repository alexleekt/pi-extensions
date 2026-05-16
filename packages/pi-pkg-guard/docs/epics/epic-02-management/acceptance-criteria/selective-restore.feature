Feature: Selective Package Restore

  As a pi user setting up a new machine
  I want to selectively restore packages from a backup
  So that I can choose which packages to register without installing everything

  Background:
    Given pi is configured with package-guard extension
    And a backup file exists with packages:
      | package_name    | registered |
      | pi-token-burden | false      |
      | pi-timer        | false      |
      | pi-backup       | true       |

  Scenario: Restore shows available packages
    Given I select "Restore packages from backup"
    When the restore process begins
    Then I should see packages not currently registered:
      | package_name    |
      | pi-token-burden |
      | pi-timer        |

  Scenario: Interactive package selection
    Given I select "Restore packages from backup"
    When prompted for the first package
    Then I should see options: Include, Skip, Include All, Skip All

  Scenario: Restore selected packages
    Given I select "Restore packages from backup"
    And I choose to include "pi-token-burden"
    And I choose to skip "pi-timer"
    When I confirm the selection
    Then "pi-token-burden" should be registered with pi
    And I should receive command hint: "Run this command to install: pi install npm:pi-token-burden"

  Scenario: All packages already registered
    Given all backup packages are already registered in pi
    When I select "Restore packages from backup"
    Then I should see: "✓ All packages from backup are already registered. No restore needed."

  Scenario: Restore from Gist backup
    Given a GitHub Gist is configured as backup source
    And the Gist contains packages:
      | package_name |
      | pi-foo       |
      | pi-bar       |
    When I select "Restore packages from backup"
    Then I should see packages from the Gist
