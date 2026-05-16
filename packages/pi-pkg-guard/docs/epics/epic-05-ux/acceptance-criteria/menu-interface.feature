Feature: Interactive Menu Interface

  As a pi user
  I want a clear, interactive menu to access all package-guard features
  So that I can easily navigate between scan, backup, restore, and settings

  Background:
    Given pi is configured with package-guard extension

  Scenario: Status widget displays on menu open
    Given I run "/package-guard"
    When the menu opens
    Then the status widget should show:
      | info                |
      | registered count    |
      | orphaned count      |
      | backup path         |
      | Gist status         |
      | backup sync status  |

  Scenario: Menu sections are clearly separated
    Given I run "/package-guard"
    When the menu is displayed
    Then I should see section headers:
      | header                |
      | ═══ Package Operations ═══ |
      | ═══ Configuration ═══    |
      | ═══ System ═══           |

  Scenario: Menu items under Package Operations
    Given the menu is open
    When I view Package Operations section
    Then I should see items:
      | item                           |
      | Find unregistered packages     |
      | Save backup to file + Gist     |
      | Restore packages from backup   |

  Scenario: Contextual Gist options when not configured
    Given Gist is not configured
    When the menu is displayed
    Then I should see:
      | item                           |
      | Set up new GitHub Gist backup  |

  Scenario: Contextual Gist options when configured
    Given Gist is configured with backup sync enabled
    When the menu is displayed
    Then I should see:
      | item                           |
      | Switch to a different Gist     |
      | Remove Gist backup             |
      | Disconnect Gist              |

  Scenario: Menu refresh after action
    Given I select "Find unregistered packages"
    When the action completes
    Then the menu should refresh
    And the status widget should show updated counts

  Scenario: Exit clears widget
    Given I select "Exit"
    When the command completes
    Then the status widget should clear
    And I should return to normal pi interface

  Scenario: Keyboard navigation
    Given the menu is open
    When I press ↓
    Then the selection should move down
    When I press Enter
    Then the selected action should execute
    When I press Escape
    Then the menu should close
