Feature: NPM Install Interception

  As a pi user
  I want to be warned when I attempt to install pi packages via npm directly
  So that I don't create unregistered packages in the first place

  Background:
    Given pi is configured with package-guard extension

  Scenario: Warning on npm install -g pi-*
    Given I execute bash command "npm install -g pi-token-burden"
    When the command is intercepted
    Then I should receive notification: "Use 'pi install npm:pi-token-burden' instead of 'npm install -g'"
    And the npm command should still execute

  Scenario: Warning on npm i -g pi-*
    Given I execute bash command "npm i -g pi-timer"
    When the command is intercepted
    Then I should receive notification: "Use 'pi install npm:pi-timer' instead of 'npm install -g'"

  Scenario: No warning for non-pi packages
    Given I execute bash command "npm install -g typescript"
    When the command runs
    Then no warning should be displayed

  Scenario: No warning for local installs
    Given I execute bash command "npm install pi-helper"
    When the command runs
    Then no warning should be displayed

  Scenario: No warning for non-global installs
    Given I execute bash command "npm install pi-foo"
    When the command runs
    Then no warning should be displayed
