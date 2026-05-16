Feature: Contextual Help

  As a pi user
  I want to access help information from within the package-guard interface
  So that I can understand how to use the features without leaving pi

  Background:
    Given pi is configured with package-guard extension

  Scenario: Display help content
    Given I run "/package-guard"
    When I select "Show help and usage info"
    Then help text should appear in the chat transcript
    And it should contain section: "What are unregistered packages?"
    And it should contain section: "How to avoid creating unregistered packages"
    And it should contain section: "Available actions"
    And it should contain section: "Pro tips"

  Scenario: Help is non-blocking
    Given I select "Show help and usage info"
    When help is displayed
    Then I should be able to immediately reopen the menu

  Scenario: Help is internationalized
    Given my locale is set to a supported language
    When I select "Show help and usage info"
    Then help text should appear in my locale
