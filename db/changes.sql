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


-- next change, add here.

