-- 2011-05-16: language field for players

ALTER TABLE `player` ADD `language` CHAR( 2 ) NOT NULL AFTER `vipLevel`;


-- next change, add here.

ALTER TABLE game_playerstate CHANGE teamPoints upgradePoints int(10)