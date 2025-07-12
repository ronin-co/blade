#!/usr/bin/env bun

import { version } from '@/src/../package.json';
import runCLI from '@ronin/cli';

runCLI({ version });
