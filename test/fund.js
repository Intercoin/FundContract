const BigNumber = require('bignumber.js');
const util = require('util');
const FundContractMock = artifacts.require("FundContractMock");
const Aggregator = artifacts.require("Aggregator");
const ERC20Mintable = artifacts.require("ERC20Mintable");

const truffleAssert = require('truffle-assertions');
const helper = require("../helpers/truffleTestHelper");

contract('IntercoinContract', (accounts) => {
    
    // it("should assert true", async function(done) {
    //     await TestExample.deployed();
    //     assert.isTrue(true);
    //     done();
    //   });
    
    // Setup accounts.
    const accountOne = accounts[0];
    const accountTwo = accounts[1];  
    const accountThree = accounts[2];
    const accountFourth= accounts[3];
    const accountFive = accounts[4];
    const accountSix = accounts[5];
    const accountSeven = accounts[6];
    const accountEight = accounts[7];
    const accountNine = accounts[8];
    const accountTen = accounts[9];
    const accountEleven = accounts[10];
    const accountTwelwe = accounts[11];
    
    const zeroAddr = '0x0000000000000000000000000000000000000000';
    
    // predefined init params
    const timestamps = [1609459200, 1614556800, 1619827200]
    const prices = [12000000, 15000000, 18000000];
    const lastTime = 1630454400;
    const thresholds = [10000_00000000, 25000_00000000, 50000_00000000];// count in usd (mul by 1e8)
    const bonuses = [10, 20, 50]; // [0.1, 0.2, 0.5] mul by 100
    
      
    const amountETHSendToContract = 10*10**18; // 10ETH
    
    it('common test', async () => {
        var ERC20MintableInstance = await ERC20Mintable.new('t1','t1', {from: accountTen});
        var AggregatorInstance = await Aggregator.new({from: accountTen});
        var FundContractInstance = await FundContractMock.new();
        await FundContractInstance.init(
            ERC20MintableInstance.address,
            AggregatorInstance.address,
            timestamps,
            prices,
            lastTime,
            thresholds,
            bonuses,
            {from: accountTen}
        );
        
        var ratio_USD_ITR = await FundContractInstance.getTokenPrice({from: accountTen});
    
        // send ETH to Contract, but it should be revert with message "Amount exceeds allowed balance"
        await truffleAssert.reverts(
            web3.eth.sendTransaction({
                from:accountTwo,
                to: FundContractInstance.address, 
                value: amountETHSendToContract
            }), 
            "Amount exceeds allowed balance"
        );
        
        await ERC20MintableInstance.mint(FundContractInstance.address, BigNumber(1000000*1e18), {from: accountTen})

        var accountTwoBalanceBefore = await ERC20MintableInstance.balanceOf(accountTwo);
        // send ETH to Contract
        await web3.eth.sendTransaction({
            from:accountTwo,
            to: FundContractInstance.address, 
            value: amountETHSendToContract,
            gas: 2000000
        });

        var tmp = await AggregatorInstance.latestRoundData({from: accountTen});
        var ratio_ETH_USD = tmp[1];
        
        var accountTwoBalanceActual = await ERC20MintableInstance.balanceOf(accountTwo);
        var calculatedAmountOfTokens = (BigNumber(amountETHSendToContract).times(BigNumber(ratio_ETH_USD)).div(BigNumber(ratio_USD_ITR))).integerValue();
        var accountTwoBalanceExpected = BigNumber(accountTwoBalanceBefore).plus(calculatedAmountOfTokens);

        
        assert.equal(
            (accountTwoBalanceActual).toString(10),
            (accountTwoBalanceExpected.integerValue()).toString(10),
            'Balance are wrong'
        );
        
        // removed. claim and withdraw can be available for anytime
        // await truffleAssert.reverts(
        //     FundContractInstance.claim(BigNumber(amountETHSendToContract).integerValue(), accountFourth, {from: accountTen}),
        //     'claim available after `endTime` expired'
        // );
        // await truffleAssert.reverts(
        //     FundContractInstance.withdraw(BigNumber(calculatedAmountOfTokens).integerValue(), accountFive, {from: accountTen}),
        //     'withdraw available after `endTime` expired'
        // );
        //---------------------
        
        // console.log('1=',(await FundContractInstance.getExchangePriceUSD({from: accountTen})).toString());
        // helper.advanceTimeAndBlock(60*24*60*60);
        // console.log('2=',(await FundContractInstance.getExchangePriceUSD({from: accountTen})).toString());
        // helper.advanceTimeAndBlock(60*24*60*60);
        // console.log('3=',(await FundContractInstance.getExchangePriceUSD({from: accountTen})).toString());
        
        // go to end time
        helper.advanceTimeAndBlock(1630454400);
        
        var accountFourthBalanceBefore = (await web3.eth.getBalance(accountFourth));
             
        await FundContractInstance.claim(BigNumber(amountETHSendToContract).integerValue(), accountFourth, {from: accountTen});
        var accountFourthBalanceAfter = (await web3.eth.getBalance(accountFourth));
        assert.equal(
            (
                BigNumber(accountFourthBalanceAfter).minus(BigNumber(accountFourthBalanceBefore))
            ).toString(10),
            (amountETHSendToContract).toString(10),
            'after claim balance are wrong'
        );
        
        var accountFiveBalanceBefore = await ERC20MintableInstance.balanceOf(accountFive);
        await FundContractInstance.withdraw(BigNumber(calculatedAmountOfTokens).integerValue(), accountFive, {from: accountTen});
        var accountFiveBalanceActual = await ERC20MintableInstance.balanceOf(accountFive);
        var accountFiveBalanceExpected = BigNumber(accountFiveBalanceBefore).plus(calculatedAmountOfTokens);

        
        assert.equal(
            (accountFiveBalanceActual).toString(10),
            (accountFiveBalanceExpected.integerValue()).toString(10),
            'after withdraw balance are wrong'
        );

    });
    
    it('test bonuses', async () => {
        // Example:
        //     thresholds = [10000, 25000, 50000]
        //     bonuses = [0.1, 0.2, 0.5]
        //     First person contributed $10,000 and got 0.1 bonus which is $1,000
        //     Second person in same group contributed $20,000 so total of group if $30,000 and so second person gets 20% of $20,000 = $4000 while first person gets 10% of $10,000 which is another $1,000.
        
        // go to end time
        helper.advanceTimeAndBlock(1);
        
        var ERC20MintableInstance = await ERC20Mintable.new('t1','t1', {from: accountTen});
        var AggregatorInstance = await Aggregator.new({from: accountTen});
        
        var timestamps2 = [timestamps[0]+1630454400,timestamps[1]+1630454400,timestamps[2]+1630454400];
        var lastTime2 = lastTime+1630454400;
        var FundContractInstance = await FundContractMock.new();
        await FundContractInstance.init(
            ERC20MintableInstance.address,
            AggregatorInstance.address,
            timestamps2,
            prices,
            lastTime2,
            thresholds,
            bonuses,
            {from: accountTen}
        );
        var tmp = await AggregatorInstance.latestRoundData({from: accountTen});
        var ratio_ETH_USD = tmp[1];
        
        var ratio_USD_ITR = await FundContractInstance.getTokenPrice({from: accountTen});
        
        // equivalent $10k in eth
        var ethAmount1 = BigNumber(10000).times(BigNumber(1*1e18)).times(BigNumber(1*1e8)).div(BigNumber(ratio_ETH_USD));
        // equivalent $20k in eth
        var ethAmount2 = BigNumber(20000).times(BigNumber(1*1e18)).times(BigNumber(1*1e8)).div(BigNumber(ratio_ETH_USD));
        
// console.log('ethAmount1=' , ethAmount1.toString());        
// console.log('ethAmount2=' , ethAmount2.toString());        
// console.log('ratio_ETH_USD=' , ratio_ETH_USD.toString());        

        await ERC20MintableInstance.mint(FundContractInstance.address, BigNumber(1000000*1e18), {from: accountTen})
        
        await FundContractInstance.setGroup([accountOne,accountTwo], 'TestGroupName', {from: accountTen});
        
        var accountOneBalanceBefore = await ERC20MintableInstance.balanceOf(accountOne);
        var accountTwoBalanceBefore = await ERC20MintableInstance.balanceOf(accountTwo);
// console.log((await FundContractInstance.getGroupBonus('TestGroupName')).toString());                
        await web3.eth.sendTransaction({
            from:accountOne,
            to: FundContractInstance.address, 
            value: ethAmount1.integerValue(),
            gas: 2000000
        });
        
        var accountOneBalanceMiddle = await ERC20MintableInstance.balanceOf(accountOne);
// console.log((await FundContractInstance.getGroupBonus('TestGroupName')).toString());                
        await web3.eth.sendTransaction({
            from:accountTwo,
            to: FundContractInstance.address, 
            value: ethAmount2.integerValue(),
            gas: 2000000
        });
// console.log((await FundContractInstance.getGroupBonus('TestGroupName')).toString());    
// console.log((await FundContractInstance.getGroupData('TestGroupName')));    
// console.log((await FundContractInstance.getParticipantData(accountOne)));    
// console.log((await FundContractInstance.getParticipantData(accountTwo)));    



        var accountOneBalanceAfter = await ERC20MintableInstance.balanceOf(accountOne);
        var accountTwoBalanceAfter = await ERC20MintableInstance.balanceOf(accountTwo);
        
        var base = BigNumber(10000).times(BigNumber(1*1e18)).times(BigNumber(1*1e8)).div(ratio_USD_ITR);
        assert.equal(
            BigNumber(accountOneBalanceMiddle/1000000).toFixed(0),
            BigNumber(base.plus(base.times(BigNumber(0.1)))/1000000).toFixed(0),
            'accountOneBalanceMiddle wrong'
        );
        
        assert.equal(
            BigNumber(accountOneBalanceAfter/100000000).toFixed(0),
            BigNumber(base.plus(base.times(BigNumber(0.2)))/100000000).toFixed(0),
            'accountOneBalanceAfter wrong'
        );
        
    });
    
});