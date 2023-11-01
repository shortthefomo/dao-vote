<template>
    <div class="p-2 mb-3 bg-light rounded-3">
        <div class="container-fluid py-5">
            <img class="bog-roll" src="/e.png">
            <div class="col-md-8 fs-4">                
                <p class="text-muted text-end fs-6"><span class="fancy-font">DAO VOTE</span> by three</p>
            </div>
            <div class="col-md-12 fs-6">
                <p class="text">
                    Validator: {{ validatorKey.substring(0, 8) }}...
                </p>
                <p class="text">
                    Daemon: {{ daemonKey.substring(0, 8) }}...
                </p>
                <p v-if="validatorData !== null" class="text text-break">
                    Version: {{ validatorData.server_version }}
                </p>
                <p v-if="validatorData !== null" class="text text-break">
                    Latest Version: {{ validatorData.latest_version }}
                </p>
                <p v-if="validatorData !== null" class="text">
                    Ledger Index: {{ validatorData.ledger_index }}
                </p>
                <!-- <p v-if="validatorData !== null" class="text">
                    Base Fee: {{ validatorData.base_fee }}
                </p>
                <p v-if="validatorData !== null" class="text">
                    Load Fee: {{ validatorData.load_fee }}
                </p> -->
                <p v-if="validatorData !== null" class="text">
                    State: {{ validatorData.state }}
                </p>
                <p v-if="validatorData !== null" class="text">
                    Last seen: {{ secondsToString((Date.now() - validatorData.last_seen) / 1000).toString() }}
                </p>
                <p v-if="signers.length > 0">
                    SignerQuorum: {{ $store.getters.getSignerList(0).SignerQuorum }}
                </p>
                <p v-for="signer in signers">
                    <i :class="(signer.SignerEntry.Registered) ? 'bi bi-check-square-fill':'bi bi-dash-square-dotted'"></i> <i :class="`bi bi-${signer.SignerEntry.SignerWeight}-square${(signer.SignerEntry.Registered) ? '-fill':''}`"></i> {{ signer.SignerEntry.Account.substring(0, 8) }}...
                </p>
                <button v-if="validatorKey !== ''" type="button" class="btn btn-secondary" @click="unLinkAccount()">Unlink</button>
            </div>
        </div>
    </div>
    <div v-if="validatorData !== null && validatorKey !== ''" class="py-5 mb-4">
        <h1 class="display-5 fw-bold">Voting Status</h1>
        <div class="container-fluid pb-5">
            <table class="table">
                <thead class="table-dark">
                    <tr>
                        <th>Amendment</th>
                        <th>Flag</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="row in votes" @click="selectedRow(row)" :class="highlights(row)">
                        <td><span class="px-2 py-1">{{ row.label }}</span></td>
                        <td><span :class="(row.flag === 'yay') ? 'bg-green text-light px-2 py-1': 'bg-pink text-light px-2 py-1'">{{ row.flag }}</span></td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
    <div v-else-if="validatorKey !== ''">
        <div class="container-fluid mb-5 p-2 bg-light">
            <h3 class="fw-bold text-center">{Waiting for validators data}</h3>
            <p class="text-center" v-if="isLoading">Loading validator..</p>
        </div>
    </div>
    <div v-if="validatorKey === '' && isLoading === false">
        <h1 class="display-5 fw-bold">Set Validator Info</h1>
        <input id="register_key" v-model="registerKey" placeholder="Validator public key" :class="validatorKeyValid? 'mb-2 me-2 w-full py-2 form-control border border-indigo-500 rounded':'is-invalid mb-2 me-2 w-full py-2 form-control border border-indigo-500 rounded'" aria-describedby="validationValidatorKey" required/>
        <div id="validationValidatorKey" class="invalid-feedback">
            Please enter a valid validator public key.
        </div>
    </div>
    <div v-if="validatorKey === '' && isLoading === false" class="mb-5">
        <input id="validator_daemon" v-model="daemonKey" placeholder="Validator daemon rAddress" :class="validatorDaemonValid? 'mb-2 me-2 w-full py-2 form-control border border-indigo-500 rounded':'is-invalid mb-2 me-2 w-full py-2 form-control border border-indigo-500 rounded'" aria-describedby="validatorDaemonKey" required/>
        <div id="validatorDaemonKey" class="invalid-feedback">
            Please enter a valid public rAddress.
        </div>

        <button v-if="registerKey !== '' && daemonKey !== ''" type="button" class="btn btn-primary" @click="assignValidator(registerKey, daemonKey)">Link</button>
    </div>
    <div v-if="selectedVote.length > 0">
        <p class="ms-2">Cast your vote on your validator for the selected amendments</p>
        <a class="btn btn-green m-2" @click="voteYay" role="button" id="voteYay">Vote Yay</a>
        <a class="btn btn-pink m-2" @click="voteNay" role="button" id="voteNay">Vote Nay</a>
    </div>
    <footer>
        <p class="h1 text-center">{{ledger}}</p>
        <p class="p-3 mb-2 bg-dark text-white">{{account}}</p>
    </footer>
</template>

<script>
    import { flagNames } from 'flagnames'
    import { Buffer } from 'buffer'
    const xapp = window.xAppSdk

    export default {
        name: 'Landing',
        props: ['client', 'Sdk', 'nodetype'],
        data() {
            return {
                isLoading: true,
                selectedVote: [],
                socket: null,
                registerKey: '',
                validatorKey: '',
                daemonKey: '',
                validatorData: null,
                validatorKeyValid: true,
                validatorDaemonValid: true,
                votes: [],
                signers: [],
                decoded_keys: [],
                client: null,
                masterKey: true,
                regularKey: false,
                signerList: false
            }
        },
        async mounted() {
            console.log('landing mounted...')
            // await this.fetchStorage()
            if (this.$store.getters.getAccount === '') {
                console.log('landing logged in...')
                return
            }

            
            console.log('Account', this.$store.getters.getAccount)

            if (this.$store.getters.getUserToken !== '') {
                console.log('UUID', this.$store.getters.getUserToken)
                console.log('Account', this.$store.getters.getAccount)
                const headers = { 'Content-Type': 'application/json; charset=utf-8' }
                const Payload = {
                    Account: this.$store.getters.getAccount,
                    UUID: this.$store.getters.getUserToken
                }
                await this.axios.post(`https://vote-backend.panicbot.xyz/api/v1/apps/multisig/register?appkey=${import.meta.env.VITE_XUMM_APPKEY}`, JSON.stringify(Payload), { headers })
                console.log('Registered new user', this.$store.getters.getAccount)
            }
            
            const {data} = await this.axios.get(`https://vote-backend.panicbot.xyz/api/v1/apps/validators/account?appkey=${import.meta.env.VITE_XUMM_APPKEY}&Account=${this.$store.getters.getAccount}`)
            console.log('DDDDD', data)
            if (data !== '' && 'Daemon' in data && 'Validator' in data) {
                this.validatorKey = data.Validator
                this.daemonKey = data.Daemon
            }
            console.log('validatorKey', this.validatorKey)
            console.log('daemonKey', this.daemonKey)

            this.$store.dispatch('clientConnect', false)
            this.client = this.$store.getters.getClient
            await this.connectWebsocket()
            await this.fetchAccountInfo()
            this.isLoading = false
        },
        computed: {
            ledger() {
                return this.$store.getters.getLedger
            },
            account() {
                return this.$store.getters.getAccount
            }
        },
        watch: {
            async account() {
                if (this.$store.getters.getAccount != '') {
                    console.log('landing fetchData...')
                    await this.fetchData()
                }
            }
        },
        methods: {
            async voteYay() {
                console.log('voteYay', this.selectedVote)
                if (this.decoded_keys[this.validatorKey] === undefined) {
                    console.log(`this validators key has not been decoded key ${this.validatorKey}`)
                    return
                }
                const Memos =[{
                    Memo: {
                        MemoData: Buffer.from(JSON.stringify({topic: 'amendment', amendment_vote: this.selectedVote, position: false }), 'utf-8').toString('hex').toUpperCase(),
                        MemoFormat: Buffer.from('json', 'utf-8').toString('hex').toUpperCase()
                    }
                }]
                
                const payload = {
                    TransactionType: 'AccountSet',
                    Account: this.daemonKey,
                    Memos
                }

                console.log('payload', payload)
                this.submitVote({ txjson: payload })
            },
            async voteNay() {
                console.log('voteNay', this.selectedVote)
                if (this.decoded_keys[this.validatorKey] === undefined) {
                    console.log(`this validators key has not been decoded key ${this.validatorKey}`)
                    return
                }
                const Memos =[{
                    Memo: {
                        MemoData: Buffer.from(JSON.stringify({topic: 'amendment', amendment_vote: this.selectedVote, position: true }), 'utf-8').toString('hex').toUpperCase(),
                        MemoFormat: Buffer.from('json', 'utf-8').toString('hex').toUpperCase()
                    }
                }]
                    
                const payload = {
                    TransactionType: 'AccountSet',
                    Account: this.daemonKey,
                    Memos
                }

                console.log('Tx Payload', payload)
                this.submitVote(payload)
            },
            async submitVote(payload) {
                const XummPayload = {
                    'txjson': payload,
                    custom_meta: {
                        instruction: 'Send vote to validator deamon.'
                    }
                }

                if (this.signerList) {
                    const accounts = []
                    for (let index = 0; index < this.signers.length; index++) {
                        const entry = this.signers[index].SignerEntry
                        console.log('entry', entry)
                        accounts.push(entry.Account)
                    }
                    XummPayload.options = {
                        submit: false,
                        signers: accounts
                        // multisign: true
                    }
                }
                for (let index = 0; index < this.signers.length; index++) {
                    if ('UUID' in this.signers[index].SignerEntry) {
                        console.log('Xumm Payload', XummPayload)

                        XummPayload.user_token = this.signers[index].SignerEntry.UUID
                        XummPayload.custom_meta.instruction = 'Sign Vote with account: ' + this.signers[index].SignerEntry.Account
                        const result = await this.Sdk.payload.create(XummPayload)
                        console.log('result result result', result)
                    }
                }
                

                // const self = this
                // const subscription = await this.Sdk.payload.createAndSubscribe(payload, async event => {
                //     console.log('New payload event:', event.data)

                //     if (event.data.signed === true) {
                //         console.log('Woohoo! The sign request was signed :)')
                //         if (self.signerList) {
                //             const {data} = await this.axios.get(`https://vote-backend.panicbot.xyz/api/v1/apps/payload_uuid?appkey=${import.meta.env.VITE_XUMM_APPKEY}&uuid=${event.data.payload_uuidv4}`)
                //             console.log('Fetched Xumm Sign Payload')
                //             console.log('data', data)

                //             //self.postMultisig(data.response.txid, data.response.hex)
                            
                //         }
                //         return event.data
                //     }

                //     if (event.data.signed === false) {
                //         console.log('The sign request was rejected :(')
                //         return false
                //     }
                // })
                // console.log('subscription', subscription)

                
                // xapp.openSignRequest({ uuid: subscription.created.uuid })
                //     .then(d => {
                //         // d (returned value) can be Error or return data:
                //         console.log('openSignRequest response:', d instanceof Error ? d.message : d)
                //     })
                //     .catch(e => console.log('Error:', e.message))
            },
            async postMultisig(txid, hex) {
                const headers = { 'Content-Type': 'application/json; charset=utf-8' }
                const Payload = {
                    Account: this.$store.getters.getAccount,
                    Daemon: this.daemonKey,
                    txID: txid,
                    Signature: hex
                }
                const {data} = await this.axios.post(`https://vote-backend.panicbot.xyz/api/v1/apps/multisig/signed?appkey=${import.meta.env.VITE_XUMM_APPKEY}`, JSON.stringify(Payload), { headers })

            },
            async unLinkAccount() {
                const headers = { 'Content-Type': 'application/json; charset=utf-8' }
                const Payload = {
                    Account: this.$store.getters.getAccount
                }
                await this.axios.post(`https://vote-backend.panicbot.xyz/api/v1/apps/validators/unregister?appkey=${import.meta.env.VITE_XUMM_APPKEY}`, JSON.stringify(Payload), { headers })
                this.socket.close()
                this.validatorData = null
                this.validatorKey = ''
                this.daemonKey = ''
                this.validatorKeyValid = true
                this.validatorDaemonValid = true
            },
            async submitMessageKey(key, initial = '') {
                if (this.daemonKey === '') { 
                    console.error('daemonKey not set')
                    return 
                }
                const payload = {
                    TransactionType: 'AccountSet',
                    Account: this.daemonKey,
                    MessageKey: key
                }

                const XummPayload = {
                    'txjson': payload,
                    custom_meta: {
                        instruction: (key === '') ? 'Unlink validator with account' : 'Link validator with account'
                    }
                }

                const self = this

                if (this.signerList === true) {
                    console.log('need to do sign request for multisig....')
                }
                const subscription = await this.Sdk.payload.createAndSubscribe(XummPayload, async event => {
                    console.log('New payload event:', event.data)

                    if (event.data.signed === true) {
                        if (key === '') {
                            self.validatorKey = ''
                            self.validatorData = null
                            self.accountInfo()
                        }
                        if (initial !== '') {
                            self.isLoading = false
                            self.validatorKey = initial
                            self.socket.send(JSON.stringify({
                                op: 'subscribe',
                                channel: initial
                            }))
                        }
                        console.log('Woohoo! The sign request was signed :)')
                        return event.data
                    }

                    if (event.data.signed === false) {
                        console.log('The sign request was rejected :(')
                        return false
                    }
                })
                console.log('subscription', subscription)

                xapp.openSignRequest({ uuid: subscription.created.uuid })
                    .then(d => {
                        // d (returned value) can be Error or return data:
                        console.log('openSignRequest response:', d instanceof Error ? d.message : d)
                    })
                    .catch(e => console.log('Error:', e.message))
            },
            async assignValidator(key, address) {
                await this.assignValidatorKey(key)
                await this.assignValidatorDaemonKey(address)

                
                if (this.daemonKey !== '') {
                    this.fetchAccountInfo()
                }

                if (!(this.validatorKeyValid && this.validatorDaemonValid)) { return }
                const headers = { 'Content-Type': 'application/json; charset=utf-8' }
                const Payload = {
                    Daemon: address,
                    Account: this.$store.getters.getAccount,
                    Validator: key
                }
                await this.axios.post(`https://vote-backend.panicbot.xyz/api/v1/apps/validators/register?appkey=${import.meta.env.VITE_XUMM_APPKEY}`, JSON.stringify(Payload), { headers })
            },
            async assignValidatorKey(key) {
                // here we want to check the daemon account if key has been set first... not the logged in user.
                const {data} = await this.axios.get(`https://vote-backend.panicbot.xyz/api/v1/apps/decode-node-public?key=${key}`)

                if (data !== undefined && 'decoded' in data && !('error' in data)) {
                    console.log('keys', data.decoded, key)
                    this.submitMessageKey(data.decoded, key)
                    this.validatorKeyValid = true
                }
                else {
                    this.validatorKeyValid = false
                }
            },
            async assignValidatorDaemonKey(address) {
                console.log('validd....', address)
                const {data} = await this.axios.get(`https://vote-backend.panicbot.xyz/api/v1/apps/is-valid-address?address=${address}`)
                if (data !== undefined && 'isValidAddress' in data && !('error' in data)) {
                    this.validatorDaemonValid = data.isValidAddress
                }

                // const headers = { 'Content-Type': 'application/json; charset=utf-8' }
                // const Payload = {
                //     Daemon: key
                // }
                // const {data} = await this.axios.post(`https://vote-backend.panicbot.xyz/api/v1/apps/multisig/validatorDaemon?appkey=${import.meta.env.VITE_XUMM_APPKEY}`, JSON.stringify(Payload), { headers })

            },
            highlights(amendment) {
                if (this.selectedVote.includes(amendment.hash)) {
                    return 'table-secondary'
                }
                if (this.selectedVote.includes(amendment.hash)) {
                    return 'table-warning'
                }
                return ''
            },
            selectedRow(amendment) {
                if (!this.selectedVote.includes(amendment.hash)) {
                    this.selectedVote.push(amendment.hash)
                }
                else {
                    this.selectedVote.splice(this.selectedVote.indexOf(amendment.hash), 1)
                }
                console.log('Selected items', this.selectedVote)
            },
            async waitForOpenConnection(socket) {
                return new Promise((resolve, reject) => {
                    const maxNumberOfAttempts = 10
                    const intervalTime = 200 //ms

                    let currentAttempt = 0
                    const interval = setInterval(() => {
                        if (currentAttempt > maxNumberOfAttempts - 1) {
                            clearInterval(interval)
                            reject(new Error('Maximum number of attempts exceeded'))
                        } else if (socket.readyState == 1) {
                            clearInterval(interval)
                            resolve()
                        }
                        currentAttempt++
                    }, intervalTime)
                })
            },
            async connectWebsocket() {
                const self = this
                
                this.socket = new WebSocket('wss://vote-backend.panicbot.xyz')
                console.log('new connection to socket')
                this.reconnect_socket++

                if (this.ping !== undefined) {
                    clearInterval(this.ping)
                }
                
                this.socket.onopen = async function (message) {
                    await self.waitForOpenConnection(self.socket)
                    self.socket.send(JSON.stringify({
                        op: 'subscribe',
                        channel: self.$store.getters.getAccount
                    }))
                    self.ping = setInterval(function() {
                        self.socket.send(JSON.stringify({ op: 'ping' }))
                    }, 5000)
                    console.log('sockets connected! :)')
                }
                this.socket.onmessage = function (message) {
                    if (self.timeout_socket != null) {
                        clearInterval(self.timeout_socket)
                        self.timeout_socket = null
                    }

                    const data  = JSON.parse(message.data)
                    // console.log('data', data)
                    const validator = self.validatorKey
                    if (data[validator] !== undefined) {
                        self.validatorData = data[validator]
                        // console.log(self.validatorData)
                        self.votes = []
                        for (const [key, value] of Object.entries(self.validatorData.votable_amendments.nay)) {
                            self.votes.push({
                                hash: key,
                                label: value,
                                flag: 'nay'
                            })
                        }
                        for (const [key, value] of Object.entries(self.validatorData.votable_amendments.yay)) {
                            self.votes.push({
                                hash: key,
                                label: value,
                                flag: 'yay'
                            })
                        }
                    }
                }
                this.socket.onerror = function (message) {
                    console.log('There was an error connection to socket! :(', message)
                    self.socket.close()
                }

                this.socket.onclose = function (message) {
                    self.validatorData = null
                    self.selectedVote = []
                    self.votes = []
                    console.log('socket disconnected!', message)
                    if (self.timeout_socket == null && message.code != 1005) {
                        self.timeout_socket = setInterval(async () => {
                            if (self.reconnect_socket < 10) {
                                await self.connectWebsocket() 
                            }
                        }, 4000)
                    }
                }
            },
            ledgerEpoch() {
                const unix_time = Date.now() 
                return Math.floor((unix_time) / 1000) - 946684800
            },
            sortTable(col) {
                if (this.sortColumn === col) {
                    this.ascending = !this.ascending
                } else {
                    this.ascending = true
                    this.sortColumn = col
                }

                let ascending = this.ascending

                this.TokenOffers.sort(function(a, b) {
                    if (a[col] > b[col]) {
                    return ascending ? 1 : -1
                    } else if (a[col] < b[col]) {
                    return ascending ? -1 : 1
                    }
                    return 0
                })
            },
            currencyHexToUTF8(code) {
				if (code.length === 3)
					return code

				let decoded = new TextDecoder()
					.decode(this.hexToBytes(code))
				let padNull = decoded.length

				while (decoded.charAt(padNull - 1) === '\0')
					padNull--

				return decoded.slice(0, padNull)
			},
            hexToBytes(hex) {
				let bytes = new Uint8Array(hex.length / 2)

				for (let i = 0; i !== bytes.length; i++) {
					bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
				}

				return bytes
			},
            async fetchAccountInfo() {
                console.log('fetching accountInfo: ' + this.daemonKey)
                console.log('this.client', this.client)

                const payload = {
                    'id': 3,
                    'command': 'account_info',
                    'account': this.daemonKey,
                    'ledger_index': 'current'
                }
                console.log(payload)
                let res = await this.client.send(payload)
                if ('error' in res) { return }
                console.log('accountInfo')
                console.log(res)

                if ('MessageKey' in res.account_data) {
                    const { data } = await this.axios.get(`https://vote-backend.panicbot.xyz/api/v1/apps/encode-node-public?key=${res.account_data.MessageKey}`)
                    
                    if (data !== undefined && 'encoded' in data && !('error' in data)) {
                        console.log('keys', data.encoded, res.account_data.MessageKey)
                        this.decoded_keys[data.encoded] = data.encoded
                        console.log('ValidatorKey as set on MessageKey', data.encoded)
                        // this.validatorKeyValid = true
                        // this.validatorKey = data.encoded
                        await this.waitForOpenConnection(this.socket)
                        this.socket.send(JSON.stringify({
                            op: 'subscribe',
                            channel: data.encoded
                        }))
                        console.log('subscribed to socket', data.encoded)
                    }
                }
                
                this.$store.dispatch('setAccountData', res.account_data)
                this.checkAccountData()
                this.signerList = await this.fetchSignerList()

                console.log('masterKey', this.masterKey)
                console.log('regularKey', this.regularKey)
                console.log('signerList', this.signerList)
                console.log('SingerList', this.$store.getters.getSignerList(0))
            },
            checkAccountData() {
                const account_data = this.$store.getters.getAccountData
                console.log('getAccountData', account_data)
                const flags = flagNames(account_data.LedgerEntryType, account_data.Flags)
                console.log('flags', flags)

                // check if master key enabled.
                if (flags.includes('lsfDisableMaster')) {
                    this.masterKey = false
                    console.log('masterkey disabled')
                }
                else {
                    this.masterKey = true
                    console.log('masterkey enabled')
                }

                if ('RegularKey' in account_data) {
                    this.regularKeyAddress = account_data.RegularKey
                    this.regularKey = true
                }
                else {
                    this.regularKeyAddress = null
                    this.regularKey = false
                }
            },
            async fetchSignerList(marker = undefined) {
                this.$store.dispatch('clearSignerList')
                if (this.daemonKey === '') { return }

                let found = false
                const payload = {
                    'id': 2,
                    'command': 'account_objects',
                    'account': this.daemonKey,
                    'ledger_index': 'validated',
                    'limit': 400
                }
                if (marker != undefined) {
                    payload.marker = marker
                }
                let account_objects = await this.client.send(payload)
                // console.log('signerList', account_objects)
                for (let index = 0; index < account_objects.account_objects.length; index++) {
                    const element = account_objects.account_objects[index]
                    if (element.LedgerEntryType === 'SignerList') {
                        console.log('setSignerList element', element)
                        this.$store.dispatch('setSignerList', element)
                        found = true
                    }
                }
                if (account_objects['marker'] !== undefined) {
                    return await this.checkSignerList(account_objects['marker'])
                }

                if (found) {
                    // console.log('signerLists', this.$store.getters.getSignerLists)
                    const signer_lists = this.$store.getters.getSignerLists
                    for (let index = 0; index < signer_lists.length; index++) {
                        const element = signer_lists[index]
                        console.log('signer_list', element)    
                        console.log('flags', flagNames(element.LedgerEntryType, element.Flags))
                    }
                }

                const list = this.$store.getters.getSignerList(0)
                if (list.SignerEntries !== undefined) { 
                    this.signers = list.SignerEntries

                    // console.log('Account', this.$store.getters.getAccount)
                    const headers = { 'Content-Type': 'application/json; charset=utf-8' }
                    const accounts = []
                    for (let index = 0; index < this.signers.length; index++) {
                        const entry = this.signers[index].SignerEntry
                        console.log('entry', entry)
                        accounts.push(entry.Account)
                    }
                    const Payload = {
                        Accounts: accounts
                    }
                    // console.log('Payload', Payload)
                    const {data} = await this.axios.post(`https://vote-backend.panicbot.xyz/api/v1/apps/multisig/isregistered?appkey=${import.meta.env.VITE_XUMM_APPKEY}`, JSON.stringify(Payload), { headers })
                    console.log('isregistered', data)
                    //Registered
                    for (let index = 0; index < data.length; index++) {
                        const element = data[index]
                        for (let item = 0; item < this.signers.length; item++) {
                            if (this.signers[item].SignerEntry.Account === element.Account) {
                                this.signers[item].SignerEntry.Registered = element.Registered
                                this.signers[item].SignerEntry.UUID = element.UUID
                            }
                        }
                    }
                }

                return found
            },
            secondsToString(seconds) {
                let value = seconds

                let units = {
                    "day": 24*60*60,
                    "hour": 60*60,
                    "minute": 60,
                    "second": 1
                }

                var result = []

                for(let name in units) {
                    let p =  Math.floor(value/units[name])
                    if(p == 1) result.push(" " + p + " " + name)
                    if(p >= 2) result.push(" " + p + " " + name + "s")
                    value %= units[name]
                }
                if (result.length === 0) {
                    result.push(seconds + ' seconds')
                }
                return result
            }
        },
    }
</script>
<style scoped>
    .fancy-font {
        font-family: 'Permanent Marker', serif;
    }
    .bg-green {
        background-color: #00e56a;
    }
    .bg-pink {
        background-color: #ff1a8b;
    }
    .bog-roll {
        width: 100%;
    }
    .main-text {
        color: #753ee2;
        -webkit-text-stroke-width: 1px;
        -webkit-text-stroke-color: black;
    }
    .btn-purple {
        background-color: #753ee2;
        color: #ffffff;
    }

    .btn-yellow {
        background-color: #ffc107;
        color: #ffffff;
    }
    .btn-pink {
        background-color: #ff1a8b;
        color: #ffffff;
    }

    .btn-green {
        background-color: #00e56a;
        color: #ffffff;
    }

    .table-warning {
        --bs-table-bg: #f6da86;
        color: #000;
        border-color: #e6dbb9;
    }
</style>
