# Copyright 2012-2013 Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License"). You
# may not use this file except in compliance with the License. A copy of
# the License is located at
#
#     http://aws.amazon.com/apache2.0/
#
# or in the "license" file accompanying this file. This file is
# distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
# ANY KIND, either express or implied. See the License for the specific
# language governing permissions and limitations under the License.

# language: en
@dynamodb @tables
Feature: DynamoDB Tables

  @slow
  Scenario: Creating a table
    Given I create a table with throughput 5, 10
    Then the table should eventually exist

  Scenario: Item CRUD
    Given I have a table
    When I put the item:
    """
    {"id": {"S": "foo"}, "data": {"S": "bår"}}
    """
    Then the item with id "foo" should exist
    And it should have attribute "data" containing "bår"

  Scenario: Deleting a table
    Given I have the table
    When I delete the table
    Then the table should eventually not exist

