-- 2011-05-16: language field for players

ALTER TABLE `player` ADD `language` CHAR( 2 ) NOT NULL AFTER `vipLevel`;


-- 2011-05-20: sns change

DROP TABLE `sns_friend`;
DROP TABLE `sns_friendrequest`;

CREATE TABLE `sns_relation` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `type` VARCHAR(20) NOT NULL ,
  `actorA` INT UNSIGNED NOT NULL ,
  `actorB` INT UNSIGNED NOT NULL ,
  `creationTime` INT UNSIGNED NOT NULL ,
  PRIMARY KEY (`id`) ,
  INDEX `fk_sns_relation_actorA` (`actorA` ASC) ,
  INDEX `fk_sns_relation_actorB` (`actorB` ASC) ,
  INDEX `keyType` (`type` ASC) ,
  UNIQUE INDEX `unqTypeActors` (`type` ASC, `actorA` ASC, `actorB` ASC) ,
  CONSTRAINT `fk_sns_friend_actor` FOREIGN KEY (`actorA` ) REFERENCES `actor` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_sns_friend_friend` FOREIGN KEY (`actorB` ) REFERENCES `actor` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE)
ENGINE = InnoDB;

CREATE TABLE `sns_relationrequest` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `type` VARCHAR(20) NOT NULL ,
  `actor` INT UNSIGNED NOT NULL ,
  `targetActor` INT UNSIGNED NOT NULL ,
  `creationTime` INT UNSIGNED NOT NULL ,
  PRIMARY KEY (`id`) ,
  INDEX `fk_sns_relationrequest_actor` (`actor` ASC) ,
  INDEX `fk_sns_relationrequest_targetActor` (`targetActor` ASC) ,
  UNIQUE INDEX `unq_actor_targetActor` (`actor` ASC, `targetActor` ASC) ,
  INDEX `keyType` (`type` ASC) ,
  CONSTRAINT `fk_sns_friendrequest_actor` FOREIGN KEY (`actor` ) REFERENCES `actor` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_sns_friendrequest_targetActor` FOREIGN KEY (`targetActor` ) REFERENCES `actor` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE)
ENGINE = InnoDB;


-- 2011-05-26: match log -> history

DROP TABLE `match_log_actor`, `match_log`;

CREATE TABLE `history_event` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `type` VARCHAR(255) NOT NULL ,
  `creationTime` INT UNSIGNED NOT NULL ,
  PRIMARY KEY (`id`) ,
  INDEX `key_history_event_type` (`type`(10) ASC) )
ENGINE = InnoDB;

CREATE TABLE `history_event_data` (
  `event` INT UNSIGNED NOT NULL ,
  `actor` INT UNSIGNED NULL ,
  `property` VARCHAR(50) NOT NULL ,
  `value` VARCHAR(255) NOT NULL ,
  INDEX `fk_history_event_data_event` (`event` ASC) ,
  INDEX `fk_history_event_data_actor` (`actor` ASC) ,
  PRIMARY KEY (`event`, `actor`, `property`) ,
  CONSTRAINT `fk_history_event_data_event` FOREIGN KEY (`event` ) REFERENCES `history_event` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_history_event_data_actor` FOREIGN KEY (`actor` ) REFERENCES `actor` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE)
ENGINE = InnoDB;


-- 2011-05-27: revised ranking system

DROP TABLE `score_ranking`;

CREATE TABLE `score_rankinglist` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `context` INT UNSIGNED NOT NULL ,
  `name` VARCHAR(255) NOT NULL ,
  `creationTime` INT UNSIGNED NOT NULL ,
  PRIMARY KEY (`id`) ,
  INDEX `fk_score_ranking_context` (`context` ASC) ,
  CONSTRAINT `fk_score_ranking_context` FOREIGN KEY (`context` ) REFERENCES `score_context` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE)
ENGINE = InnoDB;

CREATE TABLE `score_rankinglist_ranks` (
  `rankinglist` INT UNSIGNED NOT NULL ,
  `rank` INT UNSIGNED NOT NULL ,
  `actor` INT UNSIGNED NOT NULL ,
  `score` INT SIGNED NOT NULL ,
  PRIMARY KEY (`rankinglist`, `rank`) ,
  INDEX `fk_score_rankinglist_ranks_rankinglist` (`rankinglist` ASC) ,
  INDEX `fk_score_rankinglist_ranks_actor` (`actor` ASC) ,
  CONSTRAINT `fk_score_rankinglist_ranks_rankinglist` FOREIGN KEY (`rankinglist` ) REFERENCES `score_rankinglist` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_score_rankinglist_ranks_actor` FOREIGN KEY (`actor` ) REFERENCES `actor` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE)
ENGINE = InnoDB;

ALTER TABLE `score_log` ADD INDEX ( `receivedTime` );
ALTER TABLE `score_log` CHANGE `points` `points` INT NOT NULL;
ALTER TABLE `score_total` CHANGE `score` `score` INT NOT NULL;


-- 2011-05-27: actor data table, and moving the existing actor names into this table

CREATE TABLE `actor_data` (
  `actor` INT UNSIGNED NOT NULL ,
  `property` VARCHAR(50) NOT NULL ,
  `language` CHAR(2) NOT NULL ,
  `value` VARCHAR(255) NOT NULL ,
  PRIMARY KEY (`actor`, `property`, `language`) ,
  INDEX `fk_actor_data_actor` (`actor` ASC) ,
  CONSTRAINT `fk_actor_data_actor` FOREIGN KEY (`actor` ) REFERENCES `actor` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE)
ENGINE = InnoDB;

INSERT INTO `actor_data` SELECT `id`, 'name', '', `name` FROM `actor`;

ALTER TABLE `actor` DROP `name`;


-- 2011-05-27: npc module

CREATE TABLE `npc` (
  `actor` INT UNSIGNED NOT NULL ,
  `identifier` VARCHAR(255) NOT NULL ,
  PRIMARY KEY (`actor`) ,
  INDEX `fk_npc_actor` (`actor` ASC) ,
  CONSTRAINT `fk_npc_actor` FOREIGN KEY (`actor` ) REFERENCES `actor` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE)
ENGINE = InnoDB;

CREATE TABLE `npc_data` (
  `npc` INT UNSIGNED NOT NULL ,
  `property` VARCHAR(50) NOT NULL ,
  `language` CHAR(2) NOT NULL ,
  `value` VARCHAR(255) NOT NULL ,
  PRIMARY KEY (`npc`, `property`, `language`) ,
  INDEX `fk_npc_data_npc` (`npc` ASC) ,
  CONSTRAINT `fk_npc_data_npc` FOREIGN KEY (`npc` ) REFERENCES `npc` (`actor` ) ON DELETE CASCADE ON UPDATE CASCADE)
ENGINE = InnoDB;


-- 2011-05-30: relation limits

CREATE TABLE `sns_relation_limit` (
  `actor` INT UNSIGNED NOT NULL ,
  `type` VARCHAR(20) NOT NULL ,
  `relationLimit` INT UNSIGNED NOT NULL ,
  PRIMARY KEY (`actor`, `type`) ,
  INDEX `fk_sns_relation_limit_actor` (`actor` ASC) ,
  CONSTRAINT `fk_sns_relation_limit_actor` FOREIGN KEY (`actor` ) REFERENCES `actor` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE)
ENGINE = InnoDB;


-- 2011-05-30: notifications/messages refactored

DROP TABLE `msg_context_actor`, `msg_context_trade`, `msg_from_actor`, `msg_from_system`, `msg_to_actor`, `msg`;

CREATE TABLE `msg` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `fromActorId` INT UNSIGNED NULL ,
  `creationTime` INT UNSIGNED NOT NULL ,
  `expirationTime` INT UNSIGNED NULL ,
  `type` VARCHAR(20) NOT NULL ,
  PRIMARY KEY (`id`) ,
  INDEX `fk_msg_fromActorId` (`fromActorId` ASC) ,
  CONSTRAINT `fk_msg_fromActorId` FOREIGN KEY (`fromActorId` ) REFERENCES `actor` (`id` ) ON DELETE SET NULL ON UPDATE CASCADE)
ENGINE = InnoDB;

CREATE TABLE `msg_to_actor` (
  `msgId` INT UNSIGNED NOT NULL ,
  `actorId` INT UNSIGNED NOT NULL ,
  PRIMARY KEY (`msgId`, `actorId`) ,
  INDEX `fk_msg_to_actor_actorId` (`actorId` ASC) ,
  INDEX `fk_msg_to_actor_msgId` (`msgId` ASC) ,
  CONSTRAINT `fk_msg_to_actor_actorId` FOREIGN KEY (`actorId` ) REFERENCES `actor` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_msg_to_actor_msgId` FOREIGN KEY (`msgId` ) REFERENCES `msg` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE)
ENGINE = InnoDB;

CREATE TABLE `msg_content` (
  `msgId` INT UNSIGNED NOT NULL ,
  `language` CHAR(2) NOT NULL ,
  `title` VARCHAR(255) NOT NULL ,
  `body` MEDIUMTEXT NOT NULL ,
  PRIMARY KEY (`msgId`, `language`) ,
  INDEX `fk_msg_content_msgId` (`msgId` ASC) ,
  CONSTRAINT `fk_msg_content_msgId` FOREIGN KEY (`msgId` ) REFERENCES `msg` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE)
ENGINE = InnoDB;

CREATE TABLE `msg_data` (
  `msgId` INT UNSIGNED NOT NULL ,
  `property` VARCHAR(50) NOT NULL ,
  `language` CHAR(2) NOT NULL ,
  `type` ENUM('number','boolean','object','string') NOT NULL ,
  `value` VARCHAR(255) NOT NULL ,
  PRIMARY KEY (`msgId`, `property`, `language`) ,
  INDEX `fk_msg_data` (`msgId` ASC) ,
  CONSTRAINT `fk_msg_data` FOREIGN KEY (`msgId` ) REFERENCES `msg` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE)
ENGINE = InnoDB;


-- 2011-06-03: Gree module

CREATE TABLE `gree_user` (
  `playerId` INT UNSIGNED NOT NULL ,
  `viewerId` INT UNSIGNED NOT NULL ,
  `token` VARCHAR(255) NOT NULL ,
  `tokenSecret` VARCHAR(255) NOT NULL ,
  `status` ENUM('installed', 'suspended', 'uninstalled') NOT NULL ,
  PRIMARY KEY (`playerId`) ,
  INDEX `fk_gree_user_playerId` (`playerId` ASC) ,
  INDEX `key_viewerId` (`viewerId` ASC) ,
  CONSTRAINT `fk_gree_user_playerId` FOREIGN KEY (`playerId` ) REFERENCES `player` (`actor` ) ON DELETE CASCADE ON UPDATE CASCADE)
ENGINE = InnoDB;


-- 2011-06-06: object classes

CREATE TABLE `obj_class` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `name` VARCHAR(255) NOT NULL ,
  `weight` INT UNSIGNED NULL ,
  PRIMARY KEY (`id`) ,
  UNIQUE INDEX `name_UNIQUE` (`name`(20) ASC) )
ENGINE = InnoDB;

CREATE TABLE `obj_class_data` (
  `classId` INT UNSIGNED NOT NULL ,
  `property` VARCHAR(30) NOT NULL ,
  `tag` VARCHAR(30) NOT NULL ,
  `language` VARCHAR(2) NOT NULL ,
  `type` ENUM('number','boolean','object','string') NOT NULL ,
  `behavior` ENUM('copy','inherit','none') NOT NULL ,
  `value` VARCHAR(255) NOT NULL ,
  PRIMARY KEY (`classId`, `property`, `tag`, `language`) ,
  INDEX `fk_obj_class_data_classId` (`classId` ASC) ,
  CONSTRAINT `fk_obj_class_data_classId` FOREIGN KEY (`classId` ) REFERENCES `obj_class` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE)
ENGINE = InnoDB;

ALTER TABLE `obj_object_data` CHANGE `property` `property` VARCHAR( 30 ) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL;
ALTER TABLE `obj_object_data` ADD `language` VARCHAR( 2 ) NOT NULL AFTER `property`;
ALTER TABLE `obj_object_data` DROP PRIMARY KEY, ADD PRIMARY KEY ( `object` , `property` , `language` );
ALTER TABLE `obj_object_data` ADD `type` ENUM( 'number', 'boolean', 'object', 'string' ) NOT NULL AFTER `language`;
UPDATE `obj_object_data` SET `type` = 'string';


-- 2011-06-14: persistent data

CREATE TABLE `persistent_data` (
  `actorId` INT UNSIGNED NOT NULL ,
  `property` VARCHAR(30) NOT NULL ,
  `language` VARCHAR(2) NOT NULL ,
  `type` ENUM('number','boolean','object','string') NOT NULL ,
  `value` MEDIUMTEXT NOT NULL ,
  `expirationTime` INT UNSIGNED NOT NULL ,
  PRIMARY KEY (`actorId`, `property`, `language`) ,
  INDEX `fk_persistent_data_actorId` (`actorId` ASC) ,
  CONSTRAINT `fk_persistent_data_actorId` FOREIGN KEY (`actorId` ) REFERENCES `actor` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE)
ENGINE = InnoDB;


-- 2011-06-15: class name length restriction

ALTER TABLE `obj_class` CHANGE `name` `name` VARCHAR( 50 ) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL;
ALTER TABLE `obj_object` CHANGE `name` `name` VARCHAR( 50 ) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL;
ALTER TABLE `obj_object` DROP INDEX `key_name`, ADD INDEX `key_name` ( `name` ( 20 ) );


-- 2011-06-16: shop

CREATE TABLE `shop_purchase` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `playerId` INT UNSIGNED NOT NULL ,
  `forActorId` INT UNSIGNED NULL ,
  `creationTime` INT UNSIGNED NOT NULL ,
  `purchaseTime` INT UNSIGNED ,
  `status` ENUM('new','paid','cancelled','expired') NOT NULL ,
  PRIMARY KEY (`id`) ,
  INDEX `fk_shop_purchase_playerId` (`playerId` ASC) ,
  INDEX `fk_shop_purchase_forActorId` (`forActorId` ASC) ,
  CONSTRAINT `fk_shop_purchase_playerId` FOREIGN KEY (`playerId` ) REFERENCES `player` (`actor` ) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_shop_purchase_forActorId` FOREIGN KEY (`forActorId` ) REFERENCES `actor` (`id` ) ON DELETE RESTRICT ON UPDATE CASCADE)
ENGINE = InnoDB;

CREATE TABLE `shop_currency` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `identifier` VARCHAR(20) NOT NULL ,
  PRIMARY KEY (`id`) ,
  UNIQUE INDEX `identifier_UNIQUE` (`identifier` ASC) )
ENGINE = InnoDB;

CREATE TABLE `shop_item` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `identifier` VARCHAR(255) NOT NULL ,
  `status` ENUM('visible','invisible','unavailable') NOT NULL ,
  `sortIndex` INT UNSIGNED NOT NULL ,
  `currencyId` INT UNSIGNED NOT NULL ,
  `unitPrice` INT UNSIGNED NOT NULL ,
  PRIMARY KEY (`id`) ,
  INDEX `fk_shop_item_currencyId` (`currencyId` ASC) ,
  CONSTRAINT `fk_shop_item_currencyId` FOREIGN KEY (`currencyId` ) REFERENCES `shop_currency` (`id` ) ON DELETE RESTRICT ON UPDATE CASCADE)
ENGINE = InnoDB;

CREATE TABLE `shop_item_data` (
  `itemId` INT UNSIGNED NOT NULL ,
  `property` VARCHAR(30) NOT NULL ,
  `language` VARCHAR(2) NOT NULL ,
  `type` ENUM('number','boolean','object','string') NOT NULL ,
  `value` VARCHAR(255) NOT NULL ,
  PRIMARY KEY (`itemId`, `property`, `language`) ,
  INDEX `fk_shop_item_data_itemId` (`itemId` ASC) ,
  CONSTRAINT `fk_shop_item_data_itemId` FOREIGN KEY (`itemId` ) REFERENCES `shop_item` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE)
ENGINE = InnoDB;

CREATE TABLE `shop_purchase_item` (
  `purchaseId` INT UNSIGNED NOT NULL ,
  `itemId` INT UNSIGNED NOT NULL ,
  `currencyId` INT UNSIGNED NOT NULL ,
  `unitPrice` INT UNSIGNED NOT NULL ,
  `quantity` INT UNSIGNED NOT NULL ,
  PRIMARY KEY (`purchaseId`, `itemId`) ,
  INDEX `fk_shop_purchase_item_purchaseId` (`purchaseId` ASC) ,
  INDEX `fk_shop_purchase_item_itemId` (`itemId` ASC) ,
  INDEX `fk_shop_purchase_item_currencyId` (`currencyId` ASC) ,
  CONSTRAINT `fk_shop_purchase_item_purchaseId` FOREIGN KEY (`purchaseId` ) REFERENCES `shop_purchase` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_shop_purchase_item_itemId` FOREIGN KEY (`itemId` ) REFERENCES `shop_item` (`id` ) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_shop_purchase_item_currencyId` FOREIGN KEY (`currencyId` ) REFERENCES `shop_currency` (`id` ) ON DELETE RESTRICT ON UPDATE CASCADE)
ENGINE = InnoDB;

CREATE TABLE `shop_item_object` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `itemId` INT UNSIGNED NOT NULL ,
  `className` VARCHAR(50) NOT NULL ,
  `quantity` INT UNSIGNED NOT NULL ,
  `tags` VARCHAR(255) NOT NULL ,
  PRIMARY KEY (`id`) ,
  INDEX `fk_shop_item_object` (`itemId` ASC) ,
  CONSTRAINT `fk_shop_item_object` FOREIGN KEY (`itemId` ) REFERENCES `shop_item` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE)
ENGINE = InnoDB;


-- 2011-06-16: gree payment

CREATE TABLE `gree_payment` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `playerId` INT UNSIGNED NOT NULL ,
  `paymentId` VARCHAR(50) NOT NULL ,
  `creationTime` INT UNSIGNED NOT NULL ,
  `orderedTime` INT UNSIGNED NULL ,
  `status` ENUM('new','paid','cancelled','expired') NOT NULL ,
  `shopPurchaseId` INT UNSIGNED NOT NULL ,
  PRIMARY KEY (`id`) ,
  INDEX `fk_gree_payment_playerId` (`playerId` ASC) ,
  INDEX `fk_gree_payment_shopPurchaseId` (`shopPurchaseId` ASC) ,
  INDEX `key_paymentId` (`paymentId`(20) ASC) ,
  CONSTRAINT `fk_gree_payment_playerId` FOREIGN KEY (`playerId` ) REFERENCES `gree_user` (`playerId` ) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_gree_payment_shopPurchaseId` FOREIGN KEY (`shopPurchaseId` ) REFERENCES `shop_purchase` (`id` ) ON DELETE RESTRICT ON UPDATE CASCADE)
ENGINE = InnoDB;

CREATE TABLE `gree_payment_item` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `paymentId` INT UNSIGNED NOT NULL ,
  `description` VARCHAR(255) NOT NULL ,
  `unitPriceCoin` INT UNSIGNED NOT NULL ,
  `quantity` INT UNSIGNED NOT NULL ,
  PRIMARY KEY (`id`) ,
  INDEX `fk_gree_payment_item_paymentId` (`paymentId` ASC) ,
  CONSTRAINT `fk_gree_payment_item_paymentId` FOREIGN KEY (`paymentId` ) REFERENCES `gree_payment` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE)
ENGINE = InnoDB;


-- 2011-06-17: obj_object.creationTime

ALTER TABLE `obj_object` ADD `creationTime` INT UNSIGNED NOT NULL;


-- 2011-06-17: gc_node_data becomes type and language aware

ALTER TABLE `gc_node_data` ADD `language` VARCHAR( 2 ) NOT NULL AFTER `property`;
ALTER TABLE `gc_node_data` DROP PRIMARY KEY, ADD PRIMARY KEY ( `node` , `property` , `language` );
ALTER TABLE `gc_node_data` ADD `type` ENUM( 'number', 'boolean', 'object', 'string' ) NOT NULL AFTER `language`;
UPDATE `gc_node_data` SET type = 'string';


-- 2011-06-17: history module becomes type and language aware

ALTER TABLE `history_event_data` ADD `language` VARCHAR( 2 ) NOT NULL AFTER `property`,
ADD `type` ENUM( 'number', 'boolean', 'object', 'string' ) NOT NULL AFTER `language`;

ALTER TABLE `history_event_data` DROP PRIMARY KEY, ADD PRIMARY KEY ( `event` , `actor` , `property` , `language` );


-- 2011-06-20: NPC module data table becomes type aware

ALTER TABLE `npc_data` ADD `type` ENUM( 'number', 'boolean', 'object', 'string' ) NOT NULL AFTER `language`;
UPDATE `npc_data` SET `type` = 'string';


-- 2011-06-20: Actor data table becomes type aware

ALTER TABLE `actor_data` ADD `type` ENUM( 'number', 'boolean', 'object', 'string' ) NOT NULL AFTER `language`;
UPDATE `actor_data` SET `type` = 'string';


-- 2011-06-21: "Binary" collation on strings

ALTER DATABASE DEFAULT CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE actor CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE actor_data CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE gc_node CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE gc_node_connector_in CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE gc_node_connector_in_target CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE gc_node_connector_out CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE gc_node_connector_out_target CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE gc_node_data CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE gc_progress CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE gree_payment CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE gree_payment_item CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE gree_user CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE history_event CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE history_event_data CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE msg CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE msg_content CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE msg_data CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE msg_to_actor CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE npc CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE npc_data CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE obj_class CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE obj_class_data CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE obj_collection CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE obj_collection_object CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE obj_object CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE obj_object_data CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE persistent_data CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE player CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE player_session CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE score_context CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE score_log CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE score_rankinglist CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE score_rankinglist_ranks CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE score_total CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE shop_currency CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE shop_item CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE shop_item_data CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE shop_item_object CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE shop_purchase CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE shop_purchase_item CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE sns_relation CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE sns_relationrequest CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;
ALTER TABLE trade_offer CONVERT TO CHARACTER SET utf8 COLLATE utf8_bin;


-- 2011-06-21: shop module gets a shop table

CREATE TABLE `shop` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `name` VARCHAR(255) NOT NULL ,
  PRIMARY KEY (`id`) ,
  UNIQUE INDEX `name_UNIQUE` (`name`(20) ASC) )
ENGINE = InnoDB;

INSERT INTO `shop` VALUES(1, 'shop');

ALTER TABLE `shop_item` ADD `shopId` INT UNSIGNED NOT NULL AFTER `id`;
ALTER TABLE `shop_item` ADD INDEX ( `shopId` );
UPDATE `shop_item` SET `shopId` = 1;

ALTER TABLE `shop_item` ADD FOREIGN KEY ( `shopId` ) REFERENCES `shop` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- 2011-06-24: GREE column name change, invitation storage

ALTER TABLE `gree_user` CHANGE `viewerId` `greeUserId` INT( 10 ) UNSIGNED NOT NULL;

CREATE TABLE `gree_invitation` (
  `greeUserId` INT UNSIGNED NOT NULL ,
  `invitedByGreeUserId` INT UNSIGNED NOT NULL ,
  PRIMARY KEY (`greeUserId`),
  INDEX `key_invitedByGreeUserId` (`invitedByGreeUserId` ASC) )
ENGINE = InnoDB;


-- 2011-07-01: History module refactored

DROP TABLE `history_event_data`;
DROP TABLE `history_event`;

CREATE TABLE `history_event` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `type` VARCHAR(255) NOT NULL ,
  `creationTime` INT UNSIGNED NOT NULL ,
  PRIMARY KEY (`id`) ,
  INDEX `key_history_event_type` (`type`(10) ASC) )
ENGINE = InnoDB;

CREATE TABLE `history_event_data` (
  `eventId` INT UNSIGNED NOT NULL ,
  `actorId` INT UNSIGNED NULL ,
  `property` VARCHAR(50) NOT NULL ,
  `language` VARCHAR(2) NOT NULL ,
  `type` ENUM('number','boolean','object','string') NOT NULL ,
  `value` VARCHAR(255) NOT NULL ,
  INDEX `fk_history_event_data_eventId` (`eventId` ASC) ,
  INDEX `fk_history_event_data_actorId` (`actorId` ASC) ,
  PRIMARY KEY (`eventId`, `actorId`, `property`, `language`) ,
  CONSTRAINT `fk_history_event_data_eventId` FOREIGN KEY (`eventId` ) REFERENCES `history_event` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_history_event_data_actorId` FOREIGN KEY (`actorId` ) REFERENCES `actor` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE)
ENGINE = InnoDB;

CREATE TABLE `history_event_actor` (
  `eventId` INT UNSIGNED NOT NULL ,
  `actorId` INT UNSIGNED NOT NULL ,
  PRIMARY KEY (`eventId`, `actorId`) ,
  INDEX `fk_history_event_actor_eventId` (`eventId` ASC) ,
  INDEX `fk_history_event_actor_actorId` (`actorId` ASC) ,
  CONSTRAINT `fk_history_event_actor_eventId` FOREIGN KEY (`eventId` ) REFERENCES `history_event` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_history_event_actor_actorId` FOREIGN KEY (`actorId` ) REFERENCES `actor` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE)
ENGINE = InnoDB;


-- 2011-08-15: Some key and column length fixes.

ALTER TABLE `npc` CHANGE `identifier` `identifier` VARCHAR( 50 ) CHARACTER SET utf8 COLLATE utf8_bin NOT NULL;
ALTER TABLE `npc` ADD UNIQUE (`identifier`);
ALTER TABLE `obj_class` DROP INDEX `name_UNIQUE`, ADD UNIQUE `name_UNIQUE` ( `name` );
ALTER TABLE `gc_node` CHANGE `identifier` `identifier` VARCHAR( 50 ) CHARACTER SET utf8 COLLATE utf8_bin NOT NULL;
ALTER TABLE `gc_node` DROP INDEX `identifier_UNIQUE`, ADD UNIQUE `identifier_UNIQUE` ( `identifier` );


-- 2011-08-16: Added a table to store data per GC node, per actor

CREATE TABLE `gc_node_actor_data` (
  `nodeId` INT UNSIGNED NOT NULL,
  `actorId` INT UNSIGNED NOT NULL,
  `property` VARCHAR(50) NOT NULL,
  `language` VARCHAR(2) NOT NULL,
  `type` ENUM('number','boolean','object','string') NOT NULL,
  `value` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`nodeId`, `actorId`, `property`, `language`),
  INDEX `fk_gc_node_actor_data_nodeId` (`nodeId` ASC),
  INDEX `fk_gc_node_actor_data_actorId` (`actorId` ASC),
  CONSTRAINT `fk_gc_node_actor_data_nodeId` FOREIGN KEY (`nodeId` ) REFERENCES `gc_node` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_gc_node_actor_data_actorId` FOREIGN KEY (`actorId` ) REFERENCES `actor` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE)
ENGINE = InnoDB;


-- 2011-08-23: Collection observers

CREATE TABLE `obj_collection_observer` (
  `collectionId` INT UNSIGNED NOT NULL ,
  `actorId` INT UNSIGNED NOT NULL ,
  PRIMARY KEY (`collectionId`, `actorId`) ,
  INDEX `fk_obj_collection_observer_collectionId` (`collectionId` ASC) ,
  INDEX `fk_obj_collection_observer_actorId` (`actorId` ASC) ,
  CONSTRAINT `fk_obj_collection_observer_collectionId` FOREIGN KEY (`collectionId` ) REFERENCES `obj_collection` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_obj_collection_observer_actorId` FOREIGN KEY (`actorId` ) REFERENCES `actor` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE)
ENGINE = InnoDB;


-- 2011-08-24: Object class categories

CREATE TABLE `obj_category` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL ,
  PRIMARY KEY (`id`) ,
  UNIQUE INDEX `name_UNIQUE` (`name` ASC) )
ENGINE = InnoDB;

CREATE TABLE `obj_category_data` (
  `categoryId` INT UNSIGNED NOT NULL ,
  `property` VARCHAR(30) NOT NULL ,
  `language` VARCHAR(2) NOT NULL ,
  `type` ENUM('number','boolean','object','string') NOT NULL ,
  `value` VARCHAR(255) NOT NULL ,
  PRIMARY KEY (`categoryId`, `property`, `language`) ,
  INDEX `fk_obj_category_data_categoryId` (`categoryId` ASC) ,
  CONSTRAINT `fk_obj_category_data_categoryId` FOREIGN KEY (`categoryId` ) REFERENCES `obj_category` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE)
ENGINE = InnoDB;

CREATE TABLE `obj_class_category` (
  `classId` INT UNSIGNED NOT NULL ,
  `categoryId` INT UNSIGNED NOT NULL ,
  PRIMARY KEY (`classId`, `categoryId`) ,
  INDEX `fk_obj_class_category_categoryId` (`categoryId` ASC) ,
  INDEX `fk_obj_class_category_classId` (`classId` ASC) ,
  CONSTRAINT `fk_obj_class_category_categoryId` FOREIGN KEY (`categoryId` ) REFERENCES `obj_category` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_obj_class_category_classId` FOREIGN KEY (`classId` ) REFERENCES `obj_class` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE)
ENGINE = InnoDB;


-- 2011-08-25: SNS updates

DROP TABLE `sns_relationrequest`;

CREATE TABLE `sns_relationrequest` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `type` VARCHAR(20) NOT NULL ,
  `fromActorId` INT UNSIGNED NOT NULL ,
  `toActorId` INT UNSIGNED NOT NULL ,
  `creationTime` INT UNSIGNED NOT NULL ,
  PRIMARY KEY (`id`) ,
  INDEX `fk_sns_relationrequest_fromActorId` (`fromActorId` ASC) ,
  INDEX `fk_sns_relationrequest_toActorId` (`toActorId` ASC) ,
  UNIQUE INDEX `unq_fromActorId_toActorId` (`fromActorId` ASC, `toActorId` ASC) ,
  INDEX `keyType` (`type` ASC) ,
  CONSTRAINT `fk_sns_relationrequest_fromActorId` FOREIGN KEY (`fromActorId` ) REFERENCES `actor` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_sns_relationrequest_toActorId` FOREIGN KEY (`toActorId` ) REFERENCES `actor` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE)
ENGINE = InnoDB;


-- 2011-08-26: Shop data

CREATE TABLE `shop_data` (
  `shopId` INT UNSIGNED NOT NULL ,
  `property` VARCHAR(30) NOT NULL ,
  `language` VARCHAR(2) NOT NULL ,
  `type` ENUM('number','boolean','object','string') NOT NULL ,
  `value` VARCHAR(255) NULL ,
  PRIMARY KEY (`shopId`, `property`, `language`) ,
  INDEX `fk_shop_data_shopId` (`shopId` ASC) ,
  CONSTRAINT `fk_shop_data_shopId` FOREIGN KEY (`shopId` ) REFERENCES `shop` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE)
ENGINE = InnoDB;


-- 2011-08-31: Shop improvements

ALTER TABLE `shop` DROP INDEX `name_UNIQUE`, ADD UNIQUE `name_UNIQUE` (`name`);
ALTER TABLE `shop` CHANGE `name` `name` VARCHAR(30) CHARACTER SET utf8 COLLATE utf8_bin NOT NULL;
ALTER TABLE `shop` ADD `type` VARCHAR(255) NOT NULL;

CREATE TABLE `shop_item_object_data` (
  `itemObjectId` INT UNSIGNED NOT NULL,
  `property` VARCHAR(30) NOT NULL,
  `language` VARCHAR(2) NOT NULL,
  `type` ENUM('number','boolean','object','string') NOT NULL,
  `value` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`itemObjectId`, `property`, `language`),
  INDEX `fk_shop_item_object_data_itemObjectId` (`itemObjectId` ASC),
  CONSTRAINT `fk_shop_item_object_data_itemObjectId` FOREIGN KEY (`itemObjectId` ) REFERENCES `shop_item_object` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE)
ENGINE = InnoDB;

CREATE TABLE `shop_item_shop` (
  `shopId` INT UNSIGNED NOT NULL,
  `itemId` INT UNSIGNED NOT NULL,
  `sortIndex` INT UNSIGNED NULL,
  PRIMARY KEY (`shopId`, `itemId`),
  INDEX `fk_shop_item_shop_itemId` (`itemId` ASC),
  INDEX `fk_shop_item_shop_shopId` (`shopId` ASC),
  CONSTRAINT `fk_shop_item_shop_itemId` FOREIGN KEY (`itemId`) REFERENCES `shop_item` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_shop_item_shop_shopId` FOREIGN KEY (`shopId`) REFERENCES `shop` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE)
ENGINE = InnoDB;

INSERT INTO shop_item_shop SELECT shopId, id, sortIndex FROM shop_item;

ALTER TABLE `shop_item` DROP FOREIGN KEY `fk_shop_item_shopId`;
ALTER TABLE `shop_item` DROP FOREIGN KEY `fk_shop_item_currencyId`;
ALTER TABLE `shop_item` ADD FOREIGN KEY (`currencyId`) REFERENCES `shop_currency` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `shop_item` DROP `shopId`, DROP `sortIndex`;

ALTER TABLE `shop_purchase` ADD `shopId` INT UNSIGNED NOT NULL AFTER `forActorId`;
ALTER TABLE `shop_purchase` ADD INDEX `fk_shop_purchase_shopId` (`shopId`);
ALTER TABLE `shop_purchase` ADD FOREIGN KEY `fk_shop_purchase_shopId` (`shopId`) REFERENCES `shop` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- 2011-09-28: obj_class_actor_data

CREATE TABLE `obj_class_actor_data` (
  `classId` INT UNSIGNED NOT NULL ,
  `actorId` INT UNSIGNED NOT NULL ,
  `property` VARCHAR(30) NOT NULL ,
  `language` VARCHAR(2) NOT NULL ,
  `type` ENUM('number','boolean','object','string') NULL ,
  `value` VARCHAR(255) NULL ,
  PRIMARY KEY (`classId`, `actorId`, `property`, `language`) ,
  INDEX `fk_obj_class_actor_data_classId` (`classId` ASC) ,
  INDEX `fk_obj_class_actor_data_actorId` (`actorId` ASC) ,
  CONSTRAINT `fk_obj_class_actor_data_classId` FOREIGN KEY (`classId` ) REFERENCES `obj_class` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_obj_class_actor_data_actorId` FOREIGN KEY (`actorId` ) REFERENCES `actor` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE)
ENGINE = InnoDB;


-- 2011-10-11: dropping trade module, fixing obj_class_actor_data to NOT NULL columns

DROP TABLE `trade_counteroffer`;
DROP TABLE `trade_offer`;

ALTER TABLE `obj_class_actor_data` CHANGE `type` `type` ENUM( 'number', 'boolean', 'object', 'string' ) CHARACTER SET utf8 COLLATE utf8_bin NOT NULL ,
CHANGE `value` `value` VARCHAR( 255 ) CHARACTER SET utf8 COLLATE utf8_bin NOT NULL;


-- 2011-10-11: apple appstore integration

CREATE TABLE `apple_appstore_payment` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `actorId` INT UNSIGNED NOT NULL ,
  `shopPurchaseId` INT UNSIGNED ,
  `appleTransactionId` VARCHAR(100) NOT NULL ,
  `appleProductId` VARCHAR(100) NOT NULL ,
  `status` ENUM('paid','handled') NOT NULL ,
  `receipt` MEDIUMTEXT NOT NULL ,
  PRIMARY KEY (`id`) ,
  INDEX `keyAppleTransactionId` (`appleTransactionId` ASC) ,
  INDEX `fk_apple_appstore_payment_shopPurchaseId` (`shopPurchaseId` ASC) ,
  INDEX `fk_apple_appstore_payment_actorId` (`actorId` ASC) ,
  CONSTRAINT `fk_apple_appstore_payment_shopPurchaseId` FOREIGN KEY (`shopPurchaseId` ) REFERENCES `shop_purchase` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_apple_appstore_payment_actorId`FOREIGN KEY (`actorId` ) REFERENCES `actor` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE)
ENGINE = InnoDB;


-- 2011-10-14: Gm module tables, shop name to shop identifier

CREATE TABLE `gm` (
  `actor` INT UNSIGNED NOT NULL ,
  `username` CHAR(16) NOT NULL ,
  `password` CHAR(40) NOT NULL ,
  PRIMARY KEY (`actor`, `username`) ,
  INDEX `fk_gm_actor` (`actor` ASC) ,
  UNIQUE (`username`) ,
  CONSTRAINT `fk_gm_actor` FOREIGN KEY (`actor` ) REFERENCES `actor` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE)
ENGINE = InnoDB;

CREATE TABLE `gm_data` (
  `actor` INT UNSIGNED NOT NULL ,
  `property` VARCHAR(50) NOT NULL ,
  `language` CHAR(2) NOT NULL ,
  `type` ENUM('number','boolean','object','string') NOT NULL ,
  `value` VARCHAR(255) NOT NULL ,
  PRIMARY KEY (`actor`, `property`, `language`) ,
  INDEX `fk_gm_data_actor` (`actor` ASC) ,
  CONSTRAINT `fk_gm_data_actor` FOREIGN KEY (`actor` ) REFERENCES `gm` (`actor` ) ON DELETE CASCADE ON UPDATE CASCADE)
ENGINE = InnoDB;

ALTER TABLE `shop` CHANGE `name` `identifier` VARCHAR( 64 ) CHARACTER SET utf8 COLLATE utf8_bin NOT NULL;


-- 2011-12-12: Dropping data tables that got moved into membase

DROP TABLE `obj_object_data`;
DROP TABLE `obj_class_actor_data`;
DROP TABLE `actor_data`;
DROP TABLE `gc_node_actor_data`;


-- 2012-01-10: Refactoring msg module, to always have a msg_to_actor record, even on messages to all players (actorId NULL).

ALTER TABLE `msg_to_actor` CHANGE `actorId` `actorId` INT(10) UNSIGNED NULL;


-- 2012-02-08: Fixes to the GM tables

ALTER TABLE `gm` DROP PRIMARY KEY, ADD PRIMARY KEY (`actor`);
ALTER TABLE `gm` CHANGE `username` `username` VARCHAR( 50 ) CHARACTER SET utf8 COLLATE utf8_bin NOT NULL ,
CHANGE `password` `password` VARCHAR( 40 ) CHARACTER SET utf8 COLLATE utf8_bin NOT NULL;
ALTER TABLE `gm` ADD UNIQUE `username_UNIQUE` ( `username` );
ALTER TABLE `gm_data` CHANGE `language` `language` VARCHAR( 2 ) CHARACTER SET utf8 COLLATE utf8_bin NOT NULL;


-- 2012-03-07: Fix to the msg module, the change from 2012-01-10 does not work (fails silently)

ALTER TABLE `msg_to_actor` DROP PRIMARY KEY, ADD COLUMN id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST, CHANGE `actorId` `actorId` INT UNSIGNED NULL DEFAULT NULL;


-- v0.7.0: Player table reduction

ALTER TABLE `player` DROP `language`, DROP `lastLoginTime`;


-- v0.8.0: npc_data/shop_item_object_data varchar(255) to mediumtext

ALTER TABLE `npc_data` CHANGE `value` `value` MEDIUMTEXT CHARACTER SET utf8 COLLATE utf8_bin NOT NULL;
ALTER TABLE `shop_item_object_data` CHANGE `value` `value` MEDIUMTEXT CHARACTER SET utf8 COLLATE utf8_bin NOT NULL;

-- v0.10: table required by lib/module/gree

CREATE TABLE `gree_purchases` (
  `paymentId` varchar(64) COLLATE utf8_bin NOT NULL,
  `actorId` int(10) unsigned NOT NULL,
  `platform` varchar(20) COLLATE utf8_bin DEFAULT NULL,
  `completionCode` varchar(20) COLLATE utf8_bin NOT NULL,
  `orderedTime` int(10) unsigned NOT NULL,
  `executedTime` int(10) unsigned NOT NULL,
  `paymentItems` text COLLATE utf8_bin NOT NULL,
  `message` text COLLATE utf8_bin NOT NULL,
  PRIMARY KEY (`paymentId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

DROP TABLE `gree_invitation`;
DROP TABLE `gree_payment_item`;
DROP TABLE `gree_payment`;
DROP TABLE `gree_user`;

-- next change, add here.

