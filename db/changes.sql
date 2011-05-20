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


-- next change, add here.

