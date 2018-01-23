//=============================================================================
// 敵グループを自動設定するプラグイン
// KURAGE_AutoEnemyGroup.js
// 作成者     : Y.KURAGE
// 作成日     : 2017/08/07
// 最終更新日 : 2017/08/07
// バージョン : v1.0.0
//=============================================================================

//=============================================================================
/*:
 * @plugindesc v1.0.0 敵グループを自動設定するプラグイン
 * @author KURAGE
 *
 * @param ---- 定数 ----
 * @desc
 *
 * @param 敵グループ番号
 * @desc このパラメータで指定した敵グループ番号との戦闘を開始すると敵グループが自動設定されます。デフォルト値推奨です。
 * @default 1
 *
 * @param 敵キャラIDの下限値
 * @desc 敵キャラのID番号の下限値です。このID～上限値の範囲内であり，さらに敵キャラID最小値～最大値の敵キャラが出現します。
 * @default 1
 *
 * @param 敵キャラIDの上限値
 * @desc 敵キャラのID番号の上限値です。下限値～このIDの範囲内であり，さらに敵キャラID最小値～最大値の敵キャラが出現します。
 * @default 30
 *
 * @param ---- 変数 ----
 * @desc
 *
 * @param 敵キャラIDの最小値評価式
 * @desc 敵キャラIDの最小値を計算する評価式をスクリプト形式で記述します。デフォルトは「変数0001」を参照します。
 * @default $gameVariables.value(1)
 *
 * @param 敵キャラIDの最大値評価式
 * @desc 敵キャラIDの最大値を計算する評価式をスクリプト形式で記述します。デフォルトは「変数0002」を参照します。
 * @default $gameVariables.value(2)
 *
 * @param 最小出現数評価式
 * @desc 1戦闘で出現するエネミーの最小数をスクリプト形式で記述します。デフォルトは「1」となっています。
 * @default 1
 *
 * @param 最大出現数評価式
 * @desc 1戦闘で出現するエネミーの最大数をスクリプト形式で記述します。デフォルトはパーティーメンバー数となっています。
 * @default $gameParty.allMembers().length
 *
 * @param ---- グラフィック関連 ----
 * @desc
 *
 * @param 画像位置修正X
 * @desc モンスターの画像の位置を修正するパラメータです。
 * @default 0
 *
 * @param 画像位置修正Y
 * @desc モンスターの画像の位置を修正するパラメータです。
 * @default 64
 *
 * @param 画像のマージン
 * @desc 敵の画像どうしの間隔を指定します。デフォルト値推奨です。
 * @default 48
 *
 * @help 
 *-----------------------------------------------------------------------------
 * 概要
 *-----------------------------------------------------------------------------
 * 敵グループを自動設定するプラグインです。
 * プラグインパラメータで設定した各種数値に合わせて
 * 敵キャラを自動設定し戦闘を開始します。
 * 
 *-----------------------------------------------------------------------------
 * 使用方法
 *-----------------------------------------------------------------------------
 * プラグインをONにした後に「戦闘の処理」で「敵グループ番号1」との戦闘を開始してください。
 *
 *-----------------------------------------------------------------------------
 * プラグインコマンド
 *-----------------------------------------------------------------------------
 * このプラグインにはプラグインコマンドはありません。
 * 
 *-----------------------------------------------------------------------------
 * 本プラグインのライセンスについて(License)
 *-----------------------------------------------------------------------------
 * 本プラグインはMITライセンスのもとで公開しています。
 * This plugin is released under the MIT License.
 * 
 * Copyright (c) 2018 Y.K
 * http://opensource.org/licenses/mit-license.php
 * 
 *-----------------------------------------------------------------------------
 * 変更来歴
 *-----------------------------------------------------------------------------
 * 
 * v1.0.0 - 2018/01/23 : 初版作成
 * 
 *-----------------------------------------------------------------------------
*/
//=============================================================================

"use strict";

var Imported = Imported || {};
Imported["KURAGE_AutoEnemyGroup"] = "1.0.0";

var KURAGE = KURAGE || {};
KURAGE.AutoEnemyGroup = {};

(function($) {
  $.params = PluginManager.parameters('KURAGE_AutoEnemyGroup');

  //-----------------------------------------------------------------------------
  // Plugin global variables
  //
  $.target_troop_id    = Number($.params['敵グループ番号']);
  $.min_enemy_id       = Number($.params['敵キャラIDの下限値']);
  $.max_enemy_id       = Number($.params['敵キャラIDの上限値']);
  $.offset_x           = Number($.params['画像位置修正X']);
  $.offset_y           = Number($.params['画像位置修正Y']);
  $.margin             = Number($.params['画像のマージン']);

  //-----------------------------------------------------------------------------
  // ゲーム開始時にエネミー画像を読み込み画像サイズを取得する。
  // Get emeny bitmap size(width & height) when game started.
  // 
  var KURAGE_Scene_Boot_start = Scene_Boot.prototype.start;
  Scene_Boot.prototype.start = function() {
    KURAGE_Scene_Boot_start.call(this);
    $dataEnemies.forEach(function(enemy) {
      if(enemy && enemy.battlerName && enemy.battlerHue !== undefined) {
        var bitmap = ImageManager.loadEnemy(enemy.battlerName, enemy.battlerHue);
        bitmap._image.onload = function() {
          enemy.width  = bitmap.width;
          enemy.height = bitmap.height;
        }
      }
    });
  };

  //-----------------------------------------------------------------------------
  // Add functions of auto enemy group to BattleManager.
  // 
  var KURAGE_BattleManager_setup = BattleManager.setup;
  BattleManager.setup = function(troopId, canEscape, canLose) {
    if(troopId==$.target_troop_id) {

      $dataTroops[troopId].members = [];

      //-----------------------------------------------------------------------------
      // Global values with scripts
      //
      $.min_enemy_rank     = eval($.params['敵キャラIDの最小値評価式']);
      $.max_enemy_rank     = eval($.params['敵キャラIDの最大値評価式']);
      $.min_enemy_num      = eval($.params['最小出現数評価式']);
      $.max_enemy_num      = eval($.params['最大出現数評価式']);

      //-----------------------------------------------------------------------------
      // 敵出現数の決定
      //
      var enemy_num = Math.floor(Math.random()*($.max_enemy_num - $.min_enemy_num+1) ) + $.min_enemy_num;
      enemy_num = Math.max(1, enemy_num);

      //-----------------------------------------------------------------------------
      // 敵キャラIDの決定
      // 基本は最小値～最大値の間の値である。
      // ただし，上下限値の範囲外であれば，上下限値の範囲内に収めるよう修正する。
      //
      var enemies = [];
      var sum_enemy_width = 0;
      for(let i=0; i<enemy_num; i++) {
        var tmp_id = Math.floor(Math.random()*($.max_enemy_rank - $.min_enemy_rank+1) ) + $.min_enemy_rank;
        tmp_id = Math.max($.min_enemy_id, tmp_id);
        tmp_id = Math.min($.max_enemy_id, tmp_id);

        // 出現する敵キャラの画像サイズを合計する。
        // もし，画像サイズの合計がゲーム画面の横幅以上であった場合，敵キャラがはみ出てしまうので，
        // 敵キャラの追加を打ち切り，出現敵キャラ数もゲーム画面をはみ出ない範囲に修正する。
        sum_enemy_width += $dataEnemies[tmp_id].width + $.margin;
        if(sum_enemy_width > Graphics.boxWidth) {
          enemy_num = i;
          break;
        }

        enemies.push({id:tmp_id, x:0, y:0});
      }

      //-----------------------------------------------------------------------------
      // 敵キャラ画像の表示位置の決定
      // ツクールMVのデフォルト戦闘における画像の起点位置は左下
      //
      var sum_enemy_width = 0;
      for(let i=0; i<enemy_num; i++) {
        sum_enemy_width += $dataEnemies[ enemies[i].id ].width;
      }
      sum_enemy_width += $.margin*(enemy_num-1);

      var base_x = Graphics.boxWidth/2 - sum_enemy_width/2 + $.offset_x;
      var base_y = Graphics.boxHeight/2 + $.offset_y;
      var tmp_x = base_x;
      for(let i=0; i<enemy_num; i++) {
        tmp_x += $dataEnemies[ enemies[i].id ].width/2;
        enemies[i].x = tmp_x;
        enemies[i].y = base_y;
        tmp_x += $dataEnemies[ enemies[i].id ].width/2 + $.margin;
      }

      //-----------------------------------------------------------------------------
      // 敵出現数回だけ$dataTroopsにメンバーを追加する。
      //
      for(let i=0; i<enemy_num; i++) {
        var enemy = {enemyId:enemies[i].id, x:enemies[i].x, y:enemies[i].y, hidden:false};
        $dataTroops[troopId].members.push(enemy);
      }
    }
    KURAGE_BattleManager_setup.call(this, troopId, canEscape, canLose);
  };
  
})(KURAGE.AutoEnemyGroup); 
