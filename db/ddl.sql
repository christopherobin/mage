SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='TRADITIONAL';


-- -----------------------------------------------------
-- Table `actor`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `actor` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `creationTime` INT UNSIGNED NOT NULL ,
  PRIMARY KEY (`id`) )
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `obj_object`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `obj_object` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `appliedToObject` INT UNSIGNED NULL ,
  `weight` INT UNSIGNED NULL ,
  `name` VARCHAR(50) NOT NULL ,
  `creationTime` INT UNSIGNED NOT NULL ,
  PRIMARY KEY (`id`) ,
  INDEX `fk_obj_object_appliedToObject` (`appliedToObject` ASC) ,
  INDEX `key_name` (`name`(20) ASC) ,
  CONSTRAINT `fk_obj_object_appliedToObject`
    FOREIGN KEY (`appliedToObject` )
    REFERENCES `obj_object` (`id` )
    ON DELETE SET NULL
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `obj_collection`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `obj_collection` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `parent` INT UNSIGNED NULL ,
  `type` VARCHAR(255) NOT NULL ,
  `slotCount` INT UNSIGNED NULL ,
  `maxWeight` INT UNSIGNED NULL ,
  `owner` INT UNSIGNED NULL ,
  PRIMARY KEY (`id`) ,
  INDEX `key_type` (`type`(10) ASC) ,
  INDEX `fk_obj_collection_parent` (`parent` ASC) ,
  INDEX `fk_obj_collection_owner` (`owner` ASC) ,
  CONSTRAINT `fk_obj_collection_parent`
    FOREIGN KEY (`parent` )
    REFERENCES `obj_collection` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_obj_collection_owner`
    FOREIGN KEY (`owner` )
    REFERENCES `actor` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `obj_collection_object`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `obj_collection_object` (
  `collection` INT UNSIGNED NOT NULL ,
  `object` INT UNSIGNED NOT NULL ,
  `slot` INT UNSIGNED NULL ,
  PRIMARY KEY (`collection`, `object`) ,
  INDEX `fk_objectgroup_object_objectgroup` (`collection` ASC) ,
  INDEX `fk_objectgroup_object_object` (`object` ASC) ,
  CONSTRAINT `fk_objectgroup_object_objectgroup`
    FOREIGN KEY (`collection` )
    REFERENCES `obj_collection` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_objectgroup_object_object`
    FOREIGN KEY (`object` )
    REFERENCES `obj_object` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `sns_relation`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `sns_relation` (
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
  CONSTRAINT `fk_sns_friend_actor`
    FOREIGN KEY (`actorA` )
    REFERENCES `actor` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_sns_friend_friend`
    FOREIGN KEY (`actorB` )
    REFERENCES `actor` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `sns_relationrequest`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `sns_relationrequest` (
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
  CONSTRAINT `fk_sns_relationrequest_fromActorId`
    FOREIGN KEY (`fromActorId` )
    REFERENCES `actor` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_sns_relationrequest_toActorId`
    FOREIGN KEY (`toActorId` )
    REFERENCES `actor` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `msg`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `msg` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `fromActorId` INT UNSIGNED NULL ,
  `creationTime` INT UNSIGNED NOT NULL ,
  `expirationTime` INT UNSIGNED NULL ,
  `type` VARCHAR(20) NOT NULL ,
  PRIMARY KEY (`id`) ,
  INDEX `fk_msg_fromActorId` (`fromActorId` ASC) ,
  CONSTRAINT `fk_msg_fromActor`
    FOREIGN KEY (`fromActorId` )
    REFERENCES `actor` (`id` )
    ON DELETE SET NULL
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `msg_to_actor`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `msg_to_actor` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `msgId` INT UNSIGNED NOT NULL ,
  `actorId` INT UNSIGNED NULL ,
  PRIMARY KEY (`id`) ,
  INDEX `fk_msg_to_actor_actorId` (`actorId` ASC) ,
  INDEX `fk_msg_to_actor_msgId` (`msgId` ASC) ,
  CONSTRAINT `fk_msg_to_actor_actorId`
    FOREIGN KEY (`actorId` )
    REFERENCES `actor` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_msg_to_actor_msgId`
    FOREIGN KEY (`msgId` )
    REFERENCES `msg` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `history_event`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `history_event` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `type` VARCHAR(255) NOT NULL ,
  `creationTime` INT UNSIGNED NOT NULL ,
  PRIMARY KEY (`id`) ,
  INDEX `key_history_event_type` (`type`(10) ASC) )
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `history_event_data`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `history_event_data` (
  `eventId` INT UNSIGNED NOT NULL ,
  `actorId` INT UNSIGNED NULL ,
  `property` VARCHAR(50) NOT NULL ,
  `language` VARCHAR(2) NOT NULL ,
  `type` ENUM('number','boolean','object','string') NOT NULL ,
  `value` VARCHAR(255) NOT NULL ,
  INDEX `fk_history_event_data_eventId` (`eventId` ASC) ,
  INDEX `fk_history_event_data_actorId` (`actorId` ASC) ,
  PRIMARY KEY (`eventId`, `actorId`, `property`, `language`) ,
  CONSTRAINT `fk_history_event_data_eventId`
    FOREIGN KEY (`eventId` )
    REFERENCES `history_event` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_history_event_data_actorId`
    FOREIGN KEY (`actorId` )
    REFERENCES `actor` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `gc_node`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `gc_node` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `identifier` VARCHAR(50) NOT NULL ,
  `type` VARCHAR(255) NOT NULL ,
  PRIMARY KEY (`id`) ,
  UNIQUE INDEX `identifier_UNIQUE` (`identifier` ASC) )
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `gc_progress`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `gc_progress` (
  `actor` INT UNSIGNED NOT NULL ,
  `node` INT UNSIGNED NOT NULL ,
  `state` VARCHAR(255) NOT NULL ,
  `stateTime` INT UNSIGNED NOT NULL ,
  PRIMARY KEY (`actor`, `node`) ,
  INDEX `fk_gc_progress_actor` (`actor` ASC) ,
  INDEX `fk_gc_progress_node` (`node` ASC) ,
  CONSTRAINT `fk_gc_progress_actor`
    FOREIGN KEY (`actor` )
    REFERENCES `actor` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_gc_progress_node`
    FOREIGN KEY (`node` )
    REFERENCES `gc_node` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `score_context`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `score_context` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `name` VARCHAR(255) NOT NULL ,
  PRIMARY KEY (`id`) )
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `score_log`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `score_log` (
  `actor` INT UNSIGNED NOT NULL ,
  `context` INT UNSIGNED NOT NULL ,
  `receivedTime` INT UNSIGNED NOT NULL ,
  `points` INT NOT NULL ,
  PRIMARY KEY (`actor`, `context`, `receivedTime`) ,
  INDEX `fk_score_log_actor` (`actor` ASC) ,
  INDEX `fk_score_log_context` (`context` ASC) ,
  INDEX `keyTime` (`receivedTime` ASC) ,
  CONSTRAINT `fk_score_log_actor`
    FOREIGN KEY (`actor` )
    REFERENCES `actor` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_score_log_context`
    FOREIGN KEY (`context` )
    REFERENCES `score_context` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `score_total`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `score_total` (
  `actor` INT UNSIGNED NOT NULL ,
  `context` INT UNSIGNED NOT NULL ,
  `score` INT NOT NULL ,
  PRIMARY KEY (`actor`, `context`) ,
  INDEX `fk_score_total_actor` (`actor` ASC) ,
  INDEX `fk_score_total_context` (`context` ASC) ,
  CONSTRAINT `fk_score_total_actor`
    FOREIGN KEY (`actor` )
    REFERENCES `actor` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_score_total_context`
    FOREIGN KEY (`context` )
    REFERENCES `score_context` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `score_rankinglist`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `score_rankinglist` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `context` INT UNSIGNED NOT NULL ,
  `name` VARCHAR(255) NOT NULL ,
  `creationTime` INT UNSIGNED NOT NULL ,
  PRIMARY KEY (`id`) ,
  INDEX `fk_score_ranking_context` (`context` ASC) ,
  CONSTRAINT `fk_score_ranking_context`
    FOREIGN KEY (`context` )
    REFERENCES `score_context` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `player`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `player` (
  `actor` INT UNSIGNED NOT NULL ,
  `vipLevel` TINYINT UNSIGNED NOT NULL ,
  PRIMARY KEY (`actor`) ,
  INDEX `fk_player_actor` (`actor` ASC) ,
  CONSTRAINT `fk_player_actor`
    FOREIGN KEY (`actor` )
    REFERENCES `actor` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `gc_node_data`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `gc_node_data` (
  `node` INT UNSIGNED NOT NULL ,
  `property` VARCHAR(50) NOT NULL ,
  `language` VARCHAR(2) NOT NULL ,
  `type` ENUM('number','boolean','object','string') NOT NULL ,
  `value` MEDIUMTEXT NOT NULL ,
  PRIMARY KEY (`node`, `property`, `language`) ,
  INDEX `fk_gc_node_data_node` (`node` ASC) ,
  CONSTRAINT `fk_gc_node_data_node`
    FOREIGN KEY (`node` )
    REFERENCES `gc_node` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `gc_node_connector_out`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `gc_node_connector_out` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `node` INT UNSIGNED NOT NULL ,
  `type` VARCHAR(50) NOT NULL ,
  `onState` VARCHAR(50) NOT NULL ,
  PRIMARY KEY (`id`) ,
  INDEX `key_type` (`type`(15) ASC) ,
  INDEX `fk_gc_node_connector_out_node` (`node` ASC) ,
  CONSTRAINT `fk_gc_node_connector_out_node`
    FOREIGN KEY (`node` )
    REFERENCES `gc_node` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `gc_node_connector_out_target`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `gc_node_connector_out_target` (
  `connector` INT UNSIGNED NOT NULL ,
  `targetNode` INT UNSIGNED NOT NULL ,
  PRIMARY KEY (`connector`, `targetNode`) ,
  INDEX `fk_gc_node_connector_out_on_connector` (`connector` ASC) ,
  INDEX `fk_ gc_node_connector_out_on_targetNode` (`targetNode` ASC) ,
  CONSTRAINT `fk_gc_node_connector_out_on_connector`
    FOREIGN KEY (`connector` )
    REFERENCES `gc_node_connector_out` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_ gc_node_connector_out_on_targetNode`
    FOREIGN KEY (`targetNode` )
    REFERENCES `gc_node` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `gc_node_connector_in`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `gc_node_connector_in` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `node` INT UNSIGNED NOT NULL ,
  `type` VARCHAR(50) NOT NULL ,
  `andGroup` TINYINT UNSIGNED NOT NULL ,
  PRIMARY KEY (`id`) ,
  INDEX `fk_ gc_node_connector_in_node` (`node` ASC) ,
  INDEX `key_type` (`type`(15) ASC) ,
  CONSTRAINT `fk_ gc_node_connector_in_node`
    FOREIGN KEY (`node` )
    REFERENCES `gc_node` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `gc_node_connector_in_target`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `gc_node_connector_in_target` (
  `connector` INT UNSIGNED NOT NULL ,
  `targetNode` INT UNSIGNED NOT NULL ,
  `onState` VARCHAR(50) NOT NULL ,
  PRIMARY KEY (`connector`, `targetNode`) ,
  INDEX `fk_ gc_node_connector_in_stategroup_connector` (`connector` ASC) ,
  INDEX `fk_ gc_node_connector_in_stategroup_targetNode` (`targetNode` ASC) ,
  CONSTRAINT `fk_ gc_node_connector_in_stategroup_connector`
    FOREIGN KEY (`connector` )
    REFERENCES `gc_node_connector_in` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_ gc_node_connector_in_stategroup_targetNode`
    FOREIGN KEY (`targetNode` )
    REFERENCES `gc_node` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `score_rankinglist_ranks`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `score_rankinglist_ranks` (
  `rankinglist` INT UNSIGNED NOT NULL ,
  `rank` INT UNSIGNED NOT NULL ,
  `actor` INT UNSIGNED NOT NULL ,
  `score` INT NOT NULL ,
  PRIMARY KEY (`rankinglist`, `rank`) ,
  INDEX `fk_score_rankinglist_ranks_rankinglist` (`rankinglist` ASC) ,
  INDEX `fk_score_rankinglist_ranks_actor` (`actor` ASC) ,
  CONSTRAINT `fk_score_rankinglist_ranks_rankinglist`
    FOREIGN KEY (`rankinglist` )
    REFERENCES `score_rankinglist` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_score_rankinglist_ranks_actor`
    FOREIGN KEY (`actor` )
    REFERENCES `actor` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `npc`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `npc` (
  `actor` INT UNSIGNED NOT NULL ,
  `identifier` VARCHAR(50) NOT NULL ,
  PRIMARY KEY (`actor`) ,
  INDEX `fk_npc_actor` (`actor` ASC) ,
  UNIQUE INDEX `npc_identifier` (`identifier` ASC) ,
  CONSTRAINT `fk_npc_actor`
    FOREIGN KEY (`actor` )
    REFERENCES `actor` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `npc_data`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `npc_data` (
  `npc` INT UNSIGNED NOT NULL ,
  `property` VARCHAR(50) NOT NULL ,
  `language` CHAR(2) NOT NULL ,
  `type` ENUM('number','boolean','object','string') NOT NULL ,
  `value` VARCHAR(255) NOT NULL ,
  PRIMARY KEY (`npc`, `property`, `language`) ,
  INDEX `fk_npc_data_npc` (`npc` ASC) ,
  CONSTRAINT `fk_npc_data_npc`
    FOREIGN KEY (`npc` )
    REFERENCES `npc` (`actor` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `sns_relation_limit`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `sns_relation_limit` (
  `actor` INT UNSIGNED NOT NULL ,
  `type` VARCHAR(20) NOT NULL ,
  `relationLimit` INT UNSIGNED NOT NULL ,
  PRIMARY KEY (`actor`, `type`) ,
  INDEX `fk_sns_relation_limit_actor` (`actor` ASC) ,
  CONSTRAINT `fk_sns_relation_limit_actor`
    FOREIGN KEY (`actor` )
    REFERENCES `actor` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `msg_content`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `msg_content` (
  `msgId` INT UNSIGNED NOT NULL ,
  `language` CHAR(2) NOT NULL ,
  `title` VARCHAR(255) NOT NULL ,
  `body` MEDIUMTEXT NOT NULL ,
  PRIMARY KEY (`msgId`, `language`) ,
  INDEX `fk_msg_content_msg` (`msgId` ASC) ,
  CONSTRAINT `fk_msg_content_msg`
    FOREIGN KEY (`msgId` )
    REFERENCES `msg` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `msg_data`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `msg_data` (
  `msgId` INT UNSIGNED NOT NULL ,
  `property` VARCHAR(50) NOT NULL ,
  `language` CHAR(2) NOT NULL ,
  `type` ENUM('number','boolean','object','string') NOT NULL ,
  `value` VARCHAR(255) NOT NULL ,
  PRIMARY KEY (`msgId`, `property`, `language`) ,
  INDEX `fk_msg_data` (`msgId` ASC) ,
  CONSTRAINT `fk_msg_data`
    FOREIGN KEY (`msgId` )
    REFERENCES `msg` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `gree_user`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `gree_user` (
  `playerId` INT UNSIGNED NOT NULL ,
  `greeUserId` INT UNSIGNED NOT NULL ,
  `token` VARCHAR(255) NOT NULL ,
  `tokenSecret` VARCHAR(255) NOT NULL ,
  `status` ENUM('installed', 'suspended', 'uninstalled') NOT NULL ,
  PRIMARY KEY (`playerId`) ,
  INDEX `fk_gree_user_playerId` (`playerId` ASC) ,
  INDEX `key_viewerId` (`greeUserId` ASC) ,
  CONSTRAINT `fk_gree_user_playerId`
    FOREIGN KEY (`playerId` )
    REFERENCES `player` (`actor` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `obj_class`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `obj_class` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `name` VARCHAR(50) NOT NULL ,
  `weight` INT UNSIGNED NULL ,
  PRIMARY KEY (`id`) ,
  UNIQUE INDEX `name_UNIQUE` (`name` ASC) )
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `obj_class_data`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `obj_class_data` (
  `classId` INT UNSIGNED NOT NULL ,
  `property` VARCHAR(30) NOT NULL ,
  `tag` VARCHAR(30) NOT NULL ,
  `language` VARCHAR(2) NOT NULL ,
  `type` ENUM('number','boolean','object','string') NOT NULL ,
  `behavior` ENUM('copy','inherit','none') NOT NULL ,
  `value` VARCHAR(255) NOT NULL ,
  PRIMARY KEY (`classId`, `property`, `tag`, `language`) ,
  INDEX `fk_obj_class_data_classId` (`classId` ASC) ,
  CONSTRAINT `fk_obj_class_data_classId`
    FOREIGN KEY (`classId` )
    REFERENCES `obj_class` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `persistent_data`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `persistent_data` (
  `actorId` INT UNSIGNED NOT NULL ,
  `property` VARCHAR(30) NOT NULL ,
  `language` VARCHAR(2) NOT NULL ,
  `type` ENUM('number','boolean','object','string') NOT NULL ,
  `value` MEDIUMTEXT NOT NULL ,
  `expirationTime` INT UNSIGNED NOT NULL ,
  PRIMARY KEY (`actorId`, `property`, `language`) ,
  INDEX `fk_persistent_data_actorId` (`actorId` ASC) ,
  CONSTRAINT `fk_persistent_data_actorId`
    FOREIGN KEY (`actorId` )
    REFERENCES `actor` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `shop`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `shop` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `identifier` VARCHAR(64) NOT NULL ,
  `type` VARCHAR(255) NOT NULL ,
  PRIMARY KEY (`id`) ,
  UNIQUE INDEX `name_UNIQUE` (`identifier` ASC) )
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `shop_purchase`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `shop_purchase` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `playerId` INT UNSIGNED NOT NULL ,
  `forActorId` INT UNSIGNED NULL ,
  `shopId` INT UNSIGNED NOT NULL ,
  `creationTime` INT UNSIGNED NOT NULL ,
  `purchaseTime` INT UNSIGNED NULL ,
  `status` ENUM('new','paid','cancelled','expired') NOT NULL ,
  PRIMARY KEY (`id`) ,
  INDEX `fk_shop_purchase_playerId` (`playerId` ASC) ,
  INDEX `fk_shop_purchase_forActorId` (`forActorId` ASC) ,
  INDEX `fk_shop_purchase_shopId` (`shopId` ASC) ,
  CONSTRAINT `fk_shop_purchase_playerId`
    FOREIGN KEY (`playerId` )
    REFERENCES `player` (`actor` )
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_shop_purchase_forActorId`
    FOREIGN KEY (`forActorId` )
    REFERENCES `actor` (`id` )
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_shop_purchase_shopId`
    FOREIGN KEY (`shopId` )
    REFERENCES `shop` (`id` )
    ON DELETE RESTRICT
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `gree_payment`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `gree_payment` (
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
  CONSTRAINT `fk_gree_payment_playerId`
    FOREIGN KEY (`playerId` )
    REFERENCES `gree_user` (`playerId` )
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_gree_payment_shopPurchaseId`
    FOREIGN KEY (`shopPurchaseId` )
    REFERENCES `shop_purchase` (`id` )
    ON DELETE RESTRICT
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `shop_currency`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `shop_currency` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `identifier` VARCHAR(20) NOT NULL ,
  PRIMARY KEY (`id`) ,
  UNIQUE INDEX `identifier_UNIQUE` (`identifier` ASC) )
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `shop_item`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `shop_item` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `identifier` VARCHAR(255) NOT NULL ,
  `status` ENUM('visible','invisible','unavailable') NOT NULL ,
  `currencyId` INT UNSIGNED NOT NULL ,
  `unitPrice` INT UNSIGNED NOT NULL ,
  PRIMARY KEY (`id`) ,
  INDEX `fk_shop_item_currencyId` (`currencyId` ASC) ,
  CONSTRAINT `fk_shop_item_currencyId`
    FOREIGN KEY (`currencyId` )
    REFERENCES `shop_currency` (`id` )
    ON DELETE RESTRICT
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `shop_item_data`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `shop_item_data` (
  `itemId` INT UNSIGNED NOT NULL ,
  `property` VARCHAR(30) NOT NULL ,
  `language` VARCHAR(2) NOT NULL ,
  `type` ENUM('number','boolean','object','string') NOT NULL ,
  `value` VARCHAR(255) NOT NULL ,
  PRIMARY KEY (`itemId`, `property`, `language`) ,
  INDEX `fk_shop_item_data_itemId` (`itemId` ASC) ,
  CONSTRAINT `fk_shop_item_data_itemId`
    FOREIGN KEY (`itemId` )
    REFERENCES `shop_item` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `shop_purchase_item`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `shop_purchase_item` (
  `purchaseId` INT UNSIGNED NOT NULL ,
  `itemId` INT UNSIGNED NOT NULL ,
  `currencyId` INT UNSIGNED NOT NULL ,
  `unitPrice` INT UNSIGNED NOT NULL ,
  `quantity` INT UNSIGNED NOT NULL ,
  PRIMARY KEY (`purchaseId`, `itemId`) ,
  INDEX `fk_shop_purchase_item_purchaseId` (`purchaseId` ASC) ,
  INDEX `fk_shop_purchase_item_itemId` (`itemId` ASC) ,
  INDEX `fk_shop_purchase_item_currencyId` (`currencyId` ASC) ,
  CONSTRAINT `fk_shop_purchase_item_purchaseId`
    FOREIGN KEY (`purchaseId` )
    REFERENCES `shop_purchase` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_shop_purchase_item_itemId`
    FOREIGN KEY (`itemId` )
    REFERENCES `shop_item` (`id` )
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_shop_purchase_item_currencyId`
    FOREIGN KEY (`currencyId` )
    REFERENCES `shop_currency` (`id` )
    ON DELETE RESTRICT
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `gree_payment_item`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `gree_payment_item` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `paymentId` INT UNSIGNED NOT NULL ,
  `description` VARCHAR(255) NOT NULL ,
  `unitPriceCoin` INT UNSIGNED NOT NULL ,
  `quantity` INT UNSIGNED NOT NULL ,
  PRIMARY KEY (`id`) ,
  INDEX `fk_gree_payment_item_paymentId` (`paymentId` ASC) ,
  CONSTRAINT `fk_gree_payment_item_paymentId`
    FOREIGN KEY (`paymentId` )
    REFERENCES `gree_payment` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `shop_item_object`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `shop_item_object` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `itemId` INT UNSIGNED NOT NULL ,
  `className` VARCHAR(50) NOT NULL ,
  `quantity` INT UNSIGNED NOT NULL ,
  `tags` VARCHAR(255) NOT NULL ,
  PRIMARY KEY (`id`) ,
  INDEX `fk_shop_item_object_itemId` (`itemId` ASC) ,
  CONSTRAINT `fk_shop_item_object`
    FOREIGN KEY (`itemId` )
    REFERENCES `shop_item` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `gree_invitation`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `gree_invitation` (
  `greeUserId` INT UNSIGNED NOT NULL ,
  `invitedByGreeUserId` INT UNSIGNED NOT NULL ,
  PRIMARY KEY (`greeUserId`) ,
  INDEX `key_invitedByGreeUserId` (`invitedByGreeUserId` ASC) )
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `history_event_actor`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `history_event_actor` (
  `eventId` INT UNSIGNED NOT NULL ,
  `actorId` INT UNSIGNED NOT NULL ,
  PRIMARY KEY (`eventId`, `actorId`) ,
  INDEX `fk_history_event_actor_eventId` (`eventId` ASC) ,
  INDEX `fk_history_event_actor_actorId` (`actorId` ASC) ,
  CONSTRAINT `fk_history_event_actor_eventId`
    FOREIGN KEY (`eventId` )
    REFERENCES `history_event` (`id` )
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_history_event_actor_actorId`
    FOREIGN KEY (`actorId` )
    REFERENCES `actor` (`id` )
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `obj_collection_observer`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `obj_collection_observer` (
  `collectionId` INT UNSIGNED NOT NULL ,
  `actorId` INT UNSIGNED NOT NULL ,
  PRIMARY KEY (`collectionId`, `actorId`) ,
  INDEX `fk_obj_collection_observer_collectionId` (`collectionId` ASC) ,
  INDEX `fk_obj_collection_observer_actorId` (`actorId` ASC) ,
  CONSTRAINT `fk_obj_collection_observer_collectionId`
    FOREIGN KEY (`collectionId` )
    REFERENCES `obj_collection` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_obj_collection_observer_actorId`
    FOREIGN KEY (`actorId` )
    REFERENCES `actor` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `obj_category`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `obj_category` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `name` VARCHAR(50) NOT NULL ,
  PRIMARY KEY (`id`) ,
  UNIQUE INDEX `name_UNIQUE` (`name` ASC) )
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `obj_class_category`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `obj_class_category` (
  `classId` INT UNSIGNED NOT NULL ,
  `categoryId` INT UNSIGNED NOT NULL ,
  PRIMARY KEY (`classId`, `categoryId`) ,
  INDEX `fk_obj_class_category_categoryId` (`categoryId` ASC) ,
  INDEX `fk_obj_class_category_classId` (`classId` ASC) ,
  CONSTRAINT `fk_obj_class_category_categoryId`
    FOREIGN KEY (`categoryId` )
    REFERENCES `obj_category` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_obj_class_category_classId`
    FOREIGN KEY (`classId` )
    REFERENCES `obj_class` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `obj_category_data`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `obj_category_data` (
  `categoryId` INT UNSIGNED NOT NULL ,
  `property` VARCHAR(30) NOT NULL ,
  `language` VARCHAR(2) NOT NULL ,
  `type` ENUM('number','boolean','object','string') NOT NULL ,
  `value` VARCHAR(255) NOT NULL ,
  PRIMARY KEY (`categoryId`, `property`, `language`) ,
  INDEX `fk_obj_category_data_categoryId` (`categoryId` ASC) ,
  CONSTRAINT `fk_obj_category_data_categoryId`
    FOREIGN KEY (`categoryId` )
    REFERENCES `obj_category` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `shop_data`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `shop_data` (
  `shopId` INT UNSIGNED NOT NULL ,
  `property` VARCHAR(30) NOT NULL ,
  `language` VARCHAR(2) NOT NULL ,
  `type` ENUM('number','boolean','object','string') NOT NULL ,
  `value` VARCHAR(255) NULL ,
  PRIMARY KEY (`shopId`, `property`, `language`) ,
  INDEX `fk_shop_data_shopId` (`shopId` ASC) ,
  CONSTRAINT `fk_shop_data_shopId`
    FOREIGN KEY (`shopId` )
    REFERENCES `shop` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `shop_item_object_data`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `shop_item_object_data` (
  `itemObjectId` INT UNSIGNED NOT NULL ,
  `property` VARCHAR(30) NOT NULL ,
  `language` VARCHAR(2) NOT NULL ,
  `type` ENUM('number','boolean','object','string') NOT NULL ,
  `value` VARCHAR(255) NOT NULL ,
  PRIMARY KEY (`itemObjectId`, `property`, `language`) ,
  INDEX `fk_shop_item_object_data_itemObjectId` (`itemObjectId` ASC) ,
  CONSTRAINT `fk_shop_item_object_data_itemObjectId`
    FOREIGN KEY (`itemObjectId` )
    REFERENCES `shop_item_object` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `shop_item_shop`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `shop_item_shop` (
  `shopId` INT UNSIGNED NOT NULL ,
  `itemId` INT UNSIGNED NOT NULL ,
  `sortIndex` INT UNSIGNED NULL ,
  PRIMARY KEY (`shopId`, `itemId`) ,
  INDEX `fk_shop_item_shop_itemId` (`itemId` ASC) ,
  INDEX `fk_shop_item_shop_shopId` (`shopId` ASC) ,
  CONSTRAINT `fk_shop_item_shop_itemId`
    FOREIGN KEY (`itemId` )
    REFERENCES `shop_item` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_shop_item_shop_shopId`
    FOREIGN KEY (`shopId` )
    REFERENCES `shop` (`id` )
    ON DELETE RESTRICT
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `apple_appstore_payment`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `apple_appstore_payment` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `actorId` INT UNSIGNED NOT NULL ,
  `shopPurchaseId` INT UNSIGNED NULL ,
  `appleTransactionId` VARCHAR(100) NOT NULL ,
  `appleProductId` VARCHAR(100) NOT NULL ,
  `status` ENUM('paid','handled') NOT NULL ,
  `receipt` MEDIUMTEXT NOT NULL ,
  PRIMARY KEY (`id`) ,
  INDEX `keyAppleTransactionId` (`appleTransactionId` ASC) ,
  INDEX `fk_apple_appstore_payment_shopPurchaseId` (`shopPurchaseId` ASC) ,
  INDEX `fk_apple_appstore_payment_actorId` (`actorId` ASC) ,
  CONSTRAINT `fk_apple_appstore_payment_shopPurchaseId`
    FOREIGN KEY (`shopPurchaseId` )
    REFERENCES `shop_purchase` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_apple_appstore_payment_actorId`
    FOREIGN KEY (`actorId` )
    REFERENCES `actor` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `gm`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `gm` (
  `actor` INT UNSIGNED NOT NULL ,
  `username` VARCHAR(50) NOT NULL ,
  `password` VARCHAR(40) NOT NULL ,
  PRIMARY KEY (`actor`) ,
  INDEX `fk_gm_actor` (`actor` ASC) ,
  UNIQUE INDEX `username_UNIQUE` (`username` ASC) ,
  CONSTRAINT `fk_gm_actor`
    FOREIGN KEY (`actor` )
    REFERENCES `actor` (`id` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `gm_data`
-- -----------------------------------------------------
CREATE  TABLE IF NOT EXISTS `gm_data` (
  `actor` INT UNSIGNED NOT NULL ,
  `property` VARCHAR(50) NOT NULL ,
  `language` VARCHAR(2) NOT NULL ,
  `type` ENUM('number','boolean','object','string') NOT NULL ,
  `value` VARCHAR(255) NOT NULL ,
  INDEX `fk_gm_data_actor` (`actor` ASC) ,
  PRIMARY KEY (`actor`, `property`, `language`) ,
  CONSTRAINT `fk_gm_data_actor`
    FOREIGN KEY (`actor` )
    REFERENCES `gm` (`actor` )
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;



SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;


