# Gold Tech
A informal info dump about something called "gold tech".
Not really something crazy but it does allow for better mod responses.
We'll also teach you how to make a impractial but possible feature by understanding gold tech (at least what it does).

## What is gold tech?
It is something entirely having to do with gold.
MooMoo.io uses ``sort()`` when sorting and finding the top 10 players to update leaderboard.
Because ``sort()`` mutates the array in place, during game updates, players with more gold are indexed lower (update first) compared to players with less gold.

## What the fuck is the point?
because MooMoo.io's updates kinda like this:
```js
for (let i = 0; i < players.length; i++) {
    players[i].update();
}
```
> where movement/velocity is done then weapon attacking (which applies velocity)

Being indexed lower actually gives u a in-game advantage (relatively small but it is a benefit).
Here are all the features that are impossible and healable without soldier if you do it against a person indexed lower:
- kbonetick (onetick someone into a spike)
- kbhit (any amount of spikes)

stuff that it allows us to make or do:
- (almost) perfectly accurate kb simulations (of course MooMoo.io rounds/truncates floating numbers before emitting them to clients but using gold tech we can achieve the highest accuracy)
- the tech we'll teach u how to make

### Small little example:
If Player A is indexed lower:
- Player A update() is called:
    - it updates movement
    - calls gather() and hits player B
- Player B's update() is called next:
    - it updates movement (which has the newly applied knockback from player B)

If Player A is indexed higher:
- Player B's update() is called:
    - it updates movement
- Player A's update() is called next:
    - updates movement
    - calls gather()
        - this adds knockback to Player B's velocity vector, but since Player B already "updated", the knockback is applied on the NEXT tick

## How do we find player indexs?
remember how moomoo.io uses ``sort()``?

this means that the updatePlayers packet is already inheritly gold sorted for us.
we just track players via order of update since visible players is all we really care about:

```js
let updatePositionIndex = 0;

for (let i = 0; i < data.length; i += 13) {
    const player = Player.get(data[i]);
    player.updatePositionIndex = updatePositionIndex;
    updatePositionIndex++;
}
```

this makes gold tech much more relible to use since we can gather them at any time (technically all the time)
> since we don't need to poll updateLeaderboards (which is restricted to 10 players anyways)

## niche feature you can make
using ur now new found understanding of gold tech
you can create something called "no soldier antionetick"
basically countering onetick without using soldier/emp

this tech requires blood wings, polearm, and being trapped (because u need to have higher index).

here's the general process:
- Enemy Updates:
    - updates movement
    - calls gather()
        - gather() hits you with diapole damage
- Our Player Updates:
    - update movement
        - we don't move in trap
    - calls gather()
        - we hit them with blood wings equipped
        - since heals us just enough to survive the turret bullet
- Player Loop Ends
- Projectiles Loop Starts
- Turret Projectile Updates:
    - It hits us with 25 damage

> - do the math it all works out, of course polearm is required (works at any variant)
> - and no, raw healing (using food) for antionetick is impossible because js's call stack is uninterruptible
> - we will assume projectiles updates are after players updates, but it doesn't really change much since all that changes is that we need to be indexed lower

because of gold tech, we know that this is possible (which it is) and we can reliably execute this relibly without wondering why it magically doesn't work
> basically wondering why it worked yesterday but doesn't work today

here's a simple code example:
```js
function onDetectOneTick() {
    if (enemy.updatePositionIndex > player.updatePositionIndex) return useSoldier();
    if (player.tailIndex !== BLOOD_WINGS) return useSoldier();
    if (!player.primaryReloaded) return useSoldier();
    sendAttackAimmedAtEnemy();
}
```

the benefit of this? uh nothing much, but it does mean we don't need to respond with soldier to oneticks, so theoretically u can use it in autobreakers /shrug 

## what is the not niche thing we can do
you know how most mods hog soldier on kbthreat? u don't have to do that when u are indexed lower than enemy :scream:.
meaning u can do other shit during that free tick space (e.g. breaking the actual spike), and respond after when the enemy actually hits u (u wouldn't even need soldier, just normally healing would 10-0 the threat)
> - (of course u gotta do and detect threats correctly to not die but it is a huge advantage regardless)
> - also if the enemy never hits u, you'll just break the spike lmfao because ur free to use other hats and shit

of course if u want to see the practial appilications (or how it is integrated) of this tech just look at falcon's source code lol.
anyways this doucment was annoying since mega forced me to write this
> duck _worst speller in the universe_ man, signing off forever