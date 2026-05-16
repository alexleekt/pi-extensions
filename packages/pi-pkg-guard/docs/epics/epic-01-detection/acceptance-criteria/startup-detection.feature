Feature: Unregistered Detection on Startup

  As a pi user
  I want to be warned when unregistered packages are detected during session startup
  So that I'm aware of package misconfigurations before they cause issues

  Background:
    Given pi is configured with package-guard extension
    And npm global packages are installed

  Scenario: Unregistered packages detected on startup
    Given unregistered pi packages exist in npm global
      | package_name     |
      | pi-token-burden  |
      | pi-timer         |
    When a new pi session starts
    Then the status area should display "2 unregistered pi package(s). Run /package-guard"

  Scenario: No unregistered packages
    Given no unregistered pi packages exist
    When a new pi session starts
    Then no warning should be displayed in the status area

  Scenario: Debouncing prevents repeated checks
    Given unregistered packages were detected within the last hour
    When a new pi session starts
    Then the NPM check should be skipped
    And the cached result should be used

  Scenario: Core package exclusion
    Given @mariozechner/pi-coding-agent is installed globally
    When a new pi session starts
    Then the core package should not be counted as unregistered

  Scenario: Dev mode package exclusion
    Given pi-pkg-guard is running in dev mode (symlinked)
    When a new pi session starts
    Then pi-pkg-guard should not be counted as unregistered
